(self as any).document = {
  createElement(type) {
    if (type === 'canvas') {
      return new OffscreenCanvas(0, 0);
    } else {
      console.log('CreateElement called with type = ', type);

      return {
        style: {},
      };
    }
  },

  addEventListener() { },
};

(self as any).window = {
  console: self.console,
  addEventListener() { },
  navigator: {},
  document: self.document,
  removeEventListener: function () { },
  WebGLRenderingContext: {}
};