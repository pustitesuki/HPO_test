export class BarrierSystem {
  constructor(config, width) {
    this.config = config;
    this.updateWidth(width);
  }
  
  updateWidth(width) {
    this.width = width;
    this.barriers = [];
    
    // 7 barriers heavily concentrated in the center
    const d = width / 16;
    for (let i = 0; i < this.config.barrierCount; i++) {
      const xPos = (i - 3) * d; // Center is 3 for 7 barriers
      this.barriers.push({
        x: xPos,
        rate: this.config.captureRates[i]
      });
    }
  }

  // Returns { passed: boolean, captured: boolean, barrierIndex: number, barrierX: number }
  checkCapture(x, oldX, lastPassedBarrierIndex) {
    for (let i = lastPassedBarrierIndex + 1; i < this.barriers.length; i++) {
      const barrier = this.barriers[i];
      const captureZoneStart = barrier.x - this.config.barrierCaptureZone;

      // If particle just entered or crossed the capture zone
      if (oldX < captureZoneStart && x >= captureZoneStart) {
        // Trigger capture roll
        if (Math.random() < barrier.rate) {
          return {
            passed: false,
            captured: true,
            barrierIndex: i,
            barrierX: barrier.x
          };
        } else {
          // Passed this barrier
          return {
            passed: true,
            captured: false,
            barrierIndex: i,
            barrierX: barrier.x
          };
        }
      }
    }
    
    return { passed: false, captured: false };
  }
}
