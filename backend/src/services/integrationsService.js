const { integrationSeed } = require('../data/integrations');

const integrations = integrationSeed;

function listIntegrations() {
  return integrations;
}

function createIntegration(data) {
  if (!data.name || !data.type) {
    throw new Error('Nombre y tipo son requeridos');
  }

  const integration = {
    id: `int${Date.now()}`,
    name: data.name,
    type: data.type,
    status: data.status || 'pending',
    lastSync: data.lastSync || new Date().toISOString(),
    owner: data.owner || 'Sin asignar',
    enabled: data.enabled ?? true
  };

  integrations.push(integration);
  return integration;
}

module.exports = { listIntegrations, createIntegration };
