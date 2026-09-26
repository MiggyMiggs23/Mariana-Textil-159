(() => {
  const RealDate = Date;
  const epoch = RealDate.parse("2026-10-02T18:00:00.000Z");
  const FrozenDate = new Proxy(RealDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length ? args : [epoch], newTarget);
    },
    apply() { return new RealDate(epoch).toString(); },
    get(target, key, receiver) { return key === "now" ? () => epoch : Reflect.get(target, key, receiver); },
  });
  globalThis.Date = FrozenDate;
})();