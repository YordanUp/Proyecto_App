const {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType
} = require('docx');
const reportService = require('./reportService');
const { recordAudit } = require('./auditService');

const MAX_DOCX_EXPORT_LIMIT = 2000;
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function exportError(statusCode, errorCode, message) {
  return Object.assign(new Error(message), { statusCode, errorCode });
}

function plainName(value, fallback = 'Sin nombre') {
  if (value && typeof value === 'object') return value.name || value.folio || fallback;
  return fallback;
}

function formatProducts(items, type) {
  if (!Array.isArray(items) || items.length === 0) return [new Paragraph('Sin productos')];
  return items.map(item => new Paragraph(`• ${formatProductText(item, type)}`));
}

function formatProductText(item, type) {
  const product = item.product && typeof item.product === 'object' ? item.product : null;
  const name = product?.name || item.productNameSnapshot || 'Producto';
  const code = product?.code || item.skuSnapshot || '';
  const quantity = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(Number(item.quantity || 0));
  const priceField = type === 'purchases' ? 'unitCost' : 'unitPrice';
  const amount = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(item[priceField] || 0));
  return `${name}${code ? ` (${code})` : ''} — ${quantity} × ${amount}`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));
}

function periodLabel(query) {
  const from = query.from || query.dateFrom;
  const to = query.to || query.dateTo;
  if (!from && !to) return 'Todos los registros disponibles';
  return `${from ? formatDate(from) : 'Inicio'} al ${to ? formatDate(to) : 'presente'}`;
}

function paragraph(text, options = {}) {
  if (typeof text !== 'string' && typeof text !== 'number') {
    throw new TypeError('El contenido de un párrafo debe ser texto o número');
  }
  return new Paragraph({ text: String(text), ...options });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 260, after: 120 }, keepNext: true });
}

function tableCell(value, { header = false, width } = {}) {
  const values = Array.isArray(value) ? value : [value];
  const children = values.flatMap(item => {
    if (item instanceof Paragraph) return [item];
    if (typeof item === 'string' || typeof item === 'number') return [paragraph(item)];
    if (item == null) return [paragraph('—')];
    throw new TypeError('Las celdas de tabla solo aceptan texto, números o párrafos');
  });
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children,
    ...(header ? { shading: { fill: 'EAF2F8' } } : {})
  });
}

function dataTable(headers, rows, widths) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'D5DCE3' };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
  const header = new TableRow({ tableHeader: true, children: headers.map((label, index) => tableCell(new Paragraph({ children: [new TextRun({ text: label, bold: true })] }), { header: true, width: widths?.[index] })) });
  const body = rows.map(row => new TableRow({ children: row.map((value, index) => tableCell(value, { width: widths?.[index] })) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [header, ...body] });
}

function groupSalesByCustomer(items) {
  const groups = new Map();
  for (const sale of items) {
    const customer = plainName(sale.customer);
    const row = groups.get(customer) || { name: customer, operations: 0, gross: 0, returned: 0, net: 0 };
    row.operations += 1;
    row.gross += sale.grossTotal || 0;
    row.returned += sale.returnedTotal || 0;
    row.net += sale.netTotal || 0;
    groups.set(customer, row);
  }
  return [...groups.values()].sort((a, b) => b.net - a.net);
}

function groupPurchasesBySupplier(items) {
  const groups = new Map();
  for (const purchase of items) {
    const supplier = plainName(purchase.supplier);
    const row = groups.get(supplier) || { name: supplier, operations: 0, total: 0 };
    row.operations += 1;
    row.total += Number(purchase.total || 0);
    groups.set(supplier, row);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

function groupProducts(items, type) {
  const groups = new Map();
  for (const operation of items) {
    if (type === 'sales' && operation.status !== 'confirmed') continue;
    for (const item of operation.items || []) {
      const product = item.product && typeof item.product === 'object' ? item.product : null;
      const name = product?.name || item.productNameSnapshot || 'Producto';
      const code = product?.code || item.skuSnapshot || '';
      const key = `${name}\u0000${code}`;
      const row = groups.get(key) || { name, code, quantity: 0, amount: 0 };
      row.quantity += Number(item.quantity || 0);
      row.amount += Number(item.subtotal ?? (Number(item.quantity || 0) * Number(item[type === 'purchases' ? 'unitCost' : 'unitPrice'] || 0)));
      groups.set(key, row);
    }
  }
  return [...groups.values()].sort((a, b) => b.quantity - a.quantity);
}

function salesSummaryRows(totals, confirmedCount) {
  return [
    ['Ventas confirmadas', String(confirmedCount)],
    ['Ventas brutas', formatMoney(totals.grossTotal)],
    ['Devoluciones', formatMoney(totals.returnsTotal)],
    ['Ventas netas', formatMoney(totals.netTotal)]
  ];
}

function purchaseSummaryRows(totals) {
  return [
    ['Compras encontradas', String(totals.recordCount || 0)],
    ['Subtotal', formatMoney(totals.subtotal)],
    ['Impuestos', formatMoney(totals.taxes)],
    ['Total comprado', formatMoney(totals.total)]
  ];
}

function buildSalesSections(items, totals) {
  const confirmedCount = items.filter(item => item.status === 'confirmed').length;
  const summary = dataTable(['Resumen', 'Importe'], salesSummaryRows(totals, confirmedCount), [55, 45]);
  const customers = dataTable(['Cliente', 'Operaciones', 'Total bruto', 'Devuelto', 'Total neto'], groupSalesByCustomer(items).map(row => [row.name, String(row.operations), formatMoney(row.gross), formatMoney(row.returned), formatMoney(row.net)]), [30, 14, 18, 18, 20]);
  const products = dataTable(['Producto', 'Código', 'Cantidad vendida', 'Importe'], groupProducts(items, 'sales').map(row => [row.name, row.code || '—', new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(row.quantity), formatMoney(row.amount)]), [34, 18, 24, 24]);
  const details = dataTable(['Folio', 'Fecha', 'Cliente', 'Productos', 'Bruto', 'Devuelto', 'Neto'], items.map(sale => [sale.folio, formatDate(sale.confirmedAt), plainName(sale.customer), formatProducts(sale.items, 'sales'), formatMoney(sale.grossTotal), formatMoney(sale.returnedTotal), formatMoney(sale.netTotal)]), [14, 12, 14, 28, 11, 10, 11]);
  return [heading('RESUMEN'), summary, heading('VENTAS POR CLIENTE'), customers, heading('PRODUCTOS'), paragraph('Cantidad bruta de ventas confirmadas; las devoluciones no se cuentan como ventas nuevas.', { italics: true }), products, heading('DETALLE DE VENTAS'), details];
}

function buildPurchaseSections(items, totals) {
  const summary = dataTable(['Resumen', 'Importe'], purchaseSummaryRows(totals), [55, 45]);
  const suppliers = dataTable(['Proveedor', 'Operaciones', 'Total comprado'], groupPurchasesBySupplier(items).map(row => [row.name, String(row.operations), formatMoney(row.total)]), [50, 20, 30]);
  const products = dataTable(['Producto', 'Código', 'Cantidad comprada', 'Importe'], groupProducts(items, 'purchases').map(row => [row.name, row.code || '—', new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(row.quantity), formatMoney(row.amount)]), [34, 18, 24, 24]);
  const details = dataTable(['Folio', 'Fecha', 'Proveedor', 'Productos', 'Subtotal', 'Impuestos', 'Total'], items.map(purchase => [purchase.folio, formatDate(purchase.createdAt), plainName(purchase.supplier), formatProducts(purchase.items, 'purchases'), formatMoney(purchase.subtotal), formatMoney(purchase.taxes), formatMoney(purchase.total)]), [14, 12, 14, 28, 11, 10, 11]);
  return [heading('RESUMEN'), summary, heading('COMPRAS POR PROVEEDOR'), suppliers, heading('PRODUCTOS COMPRADOS'), products, heading('DETALLE DE COMPRAS'), details];
}

function buildDocument(type, items, totals, query = {}, generatedAt = new Date()) {
  if (!['sales', 'purchases'].includes(type)) throw exportError(400, 'UNSUPPORTED_REPORT_EXPORT', 'La exportación Word está disponible únicamente para ventas y compras');
  const title = type === 'sales' ? 'Reporte de Ventas' : 'Reporte de Compras';
  const generated = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(generatedAt);
  const sections = [
    new Paragraph({ text: 'YordanUp ERP', heading: HeadingLevel.TITLE, spacing: { after: 100 } }),
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 180 } }),
    paragraph(`Periodo: ${periodLabel(query)}`),
    paragraph(`Generado: ${generated}`, { spacing: { after: 120 } }),
    ... (type === 'sales' ? buildSalesSections(items, totals) : buildPurchaseSections(items, totals))
  ];
  return new Document({
    creator: 'YordanUp ERP',
    title,
    description: 'Reporte generado por YordanUp ERP',
    sections: [{ properties: { page: { margin: { top: 720, right: 540, bottom: 720, left: 540 } } }, children: sections }]
  });
}

function safeDatePart(value, fallback) {
  return String(value || fallback).replace(/[^\d-]/g, '').slice(0, 10) || fallback;
}

function reportFilename(type, query = {}) {
  if (query.from || query.to || query.dateFrom || query.dateTo) {
    const from = safeDatePart(query.from || query.dateFrom, 'inicio');
    const to = safeDatePart(query.to || query.dateTo, 'fin');
    return `reporte-${type === 'sales' ? 'ventas' : 'compras'}-${from}-a-${to}.docx`;
  }
  return `reporte-${type === 'sales' ? 'ventas' : 'compras'}-${new Date().toISOString().slice(0, 10)}.docx`;
}

async function exportDocxReport(type, query = {}, userId) {
  if (!['sales', 'purchases'].includes(type)) throw exportError(400, 'UNSUPPORTED_REPORT_EXPORT', 'La exportación Word está disponible únicamente para ventas y compras');
  const report = await reportService.getReport(type, { ...query, page: 1, limit: MAX_DOCX_EXPORT_LIMIT + 1 }, { maxLimit: MAX_DOCX_EXPORT_LIMIT + 1 });
  if (report.pagination.total > MAX_DOCX_EXPORT_LIMIT) throw exportError(413, 'REPORT_EXPORT_LIMIT', `El Word supera el límite de ${MAX_DOCX_EXPORT_LIMIT} registros; refine los filtros`);
  const document = buildDocument(type, report.items, report.totals, query);
  const buffer = await Packer.toBuffer(document);
  await recordAudit({ userId, action: 'report.docx.exported', module: 'reports', recordId: type, after: { filters: query, total: report.pagination.total, format: 'docx' } });
  return { buffer, filename: reportFilename(type, query), contentType: DOCX_MIME_TYPE, total: report.pagination.total };
}

module.exports = {
  exportDocxReport,
  buildDocument,
  formatProducts,
  formatProductText,
  groupSalesByCustomer,
  groupPurchasesBySupplier,
  groupProducts,
  salesSummaryRows,
  purchaseSummaryRows,
  reportFilename,
  MAX_DOCX_EXPORT_LIMIT,
  DOCX_MIME_TYPE
};
