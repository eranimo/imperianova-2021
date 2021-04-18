declare module "worker-loader!*" {
  // You need to change `Worker`, if you specified a different value for the `workerType` option
  class WebpackWorker extends Worker {
    constructor();
  }

  // Uncomment this if you set the `esModule` option to `false`
  // export = WebpackWorker;
  export default WebpackWorker;
}

declare module "file-loader!*" {
  const value: any;
  export default value;
}

declare module "raw-loader!*" {
  const value: any;
  export default value;
}

declare module "*.txt" {
  const value: string;
  export default value;
}
