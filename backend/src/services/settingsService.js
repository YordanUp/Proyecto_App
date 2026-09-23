const { settingsSeed } = require('../data/settings');

const settings = settingsSeed;

function listSettings() {
  return settings;
}

function createSetting(data) {
  if (!data.key || !data.label) {
    throw new Error('La clave y la etiqueta son requeridas');
  }

  const setting = {
    id: `set${Date.now()}`,
    key: data.key,
    label: data.label,
    value: data.value ?? '',
    type: data.type || 'text',
    updatedAt: new Date().toISOString()
  };

  settings.push(setting);
  return setting;
}

module.exports = { listSettings, createSetting };
