export interface InputDevice {
  isConnected(): boolean;
  listen(): void;
  unlisten(): void;
  update(): void;
  // Clear all cached/held state. Used when entering gameplay so a key still
  // "held" from a missed keyup (or menu navigation) doesn't drive the tank.
  reset(): void;
  getDownCodes(): number[];
  getHoldCodes(): number[];
  getUpCodes(): number[];
}
