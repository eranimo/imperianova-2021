module.exports = {
  plugins: ['@snowpack/plugin-typescript'],
  mount: {
    public: '/',
    src: '/dist',
  }
};