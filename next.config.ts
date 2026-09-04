import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_PAGES === '1';

const nextConfig: NextConfig = {
  output: isGitHubPages ? 'export' : undefined,
  basePath: isGitHubPages ? '/Wordroom' : '',
  assetPrefix: isGitHubPages ? '/Wordroom/' : undefined,
};

export default nextConfig;
