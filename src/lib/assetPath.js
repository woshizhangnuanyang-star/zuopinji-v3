const base = import.meta.env.BASE_URL;

export function assetPath(path) {
  if (typeof path !== 'string' || path[0] !== '/' || path[1] === '/') return path;
  return base + path.slice(1);
}

export function assetSrcSet(value) {
  return value.split(',').map(candidate => {
    const [path, ...descriptors] = candidate.trim().split(/\s+/);
    return [assetPath(path), ...descriptors].join(' ');
  }).join(', ');
}

export function withAssetBase(value) {
  if (typeof value === 'string') {
    return /^\/(assets|media|motion|projects)\//.test(value) ? assetPath(value) : value;
  }
  if (Array.isArray(value)) return value.map(withAssetBase);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, withAssetBase(child)]));
  }
  return value;
}
