/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  env: {
    infuraKey: process.env.INFURA_KEY,
    alchemyKey: process.env.ALCHEMY_KEY,
    COVALENT_KEY: process.env.COVALENT_KEY
  },
};

module.exports = nextConfig;
