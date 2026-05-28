import { brokerServiceProvider } from './brokerServiceProvider.mjs';
import { routerServiceProvider } from './routerServiceProvider.mjs';
import { queueServiceProvider } from './queueServiceProvider.mjs';
import { lifecycleServiceProvider } from './lifecycleServiceProvider.mjs';
import { observabilityServiceProvider } from './observabilityServiceProvider.mjs';
import { topologyServiceProvider } from './topologyServiceProvider.mjs';
import { librarianServiceProvider } from './librarianServiceProvider.mjs';
import { mapperServiceProvider } from './mapperServiceProvider.mjs';
import { platformServiceProvider } from './platformServiceProvider.mjs';
import { iamServiceProvider } from './iamServiceProvider.mjs';

const PROVIDERS = Object.freeze([
  brokerServiceProvider,
  routerServiceProvider,
  queueServiceProvider,
  lifecycleServiceProvider,
  observabilityServiceProvider,
  topologyServiceProvider,
  librarianServiceProvider,
  mapperServiceProvider,
  platformServiceProvider,
  iamServiceProvider
]);

const providerById = new Map(PROVIDERS.map(provider => [provider.id, provider]));

function withActionCount(provider) {
  return {
    ...provider,
    actionCount: Array.isArray(provider.actions) ? provider.actions.length : 0,
    propertyCount: Array.isArray(provider.properties) ? provider.properties.length : 0
  };
}

export function listServiceProviders({ search = '', category = '', actionId = '' } = {}) {
  const normalizedSearch = String(search || '').trim().toLowerCase();
  const normalizedCategory = String(category || '').trim().toLowerCase();
  const normalizedActionId = String(actionId || '').trim().toLowerCase();

  return PROVIDERS
    .filter(provider => {
      if (normalizedCategory && String(provider.category || '').toLowerCase() !== normalizedCategory) {
        return false;
      }

      if (normalizedActionId) {
        const hasAction = (provider.actions || []).some(action => String(action.id || '').toLowerCase() === normalizedActionId);
        if (!hasAction) return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [
        provider.id,
        provider.name,
        provider.category,
        provider.description,
        ...(provider.actions || []).map(action => `${action.id} ${action.name || ''} ${action.description || ''}`),
        ...(provider.properties || []).map(property => `${property.id} ${property.description || ''}`)
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    })
    .map(withActionCount)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getServiceProvider(providerId) {
  if (!providerId) return null;
  const provider = providerById.get(String(providerId));
  if (!provider) return null;
  return withActionCount(provider);
}

export function getServiceProviderAction(providerId, actionId) {
  const provider = getServiceProvider(providerId);
  if (!provider) return null;
  const action = (provider.actions || []).find(candidate => candidate.id === actionId);
  if (!action) return null;
  return {
    providerId: provider.id,
    providerName: provider.name,
    ...action
  };
}

export function getServiceProviderCategories() {
  return Array.from(new Set(PROVIDERS.map(provider => provider.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
