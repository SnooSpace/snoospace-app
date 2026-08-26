const map = new Map();
map.set(162, { count: 1 });

console.log('Lookup with number 162:', map.get(162));
console.log('Lookup with string "162":', map.get("162")); // undefined!

const safeMap = new Map();
safeMap.set(String(162), { count: 1 });
console.log('Safe map lookup with string "162":', safeMap.get(String("162"))); // found!
console.log('Safe map lookup with number 162:', safeMap.get(String(162))); // found!
