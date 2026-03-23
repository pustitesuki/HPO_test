export class ObjectPool {
  constructor(factoryFunc, initialSize = 0) {
    this.factoryFunc = factoryFunc;
    this.pool = [];
    
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factoryFunc());
    }
  }

  get() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return this.factoryFunc();
  }

  release(obj) {
    this.pool.push(obj);
  }
}
