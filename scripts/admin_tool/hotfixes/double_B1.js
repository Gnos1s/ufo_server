"use strict"

console.log("%s: DOUBLED ALL B1");

var original_b1_ufos = _.clone(b1_ufos);
var new_b1_ufos = [];

original_b1_ufos.forEach(function(B1, i){
  if (r_ufos[i]) B1 *= 2;
  new_b1_ufos.push(B1);
  b1_ufos[i] = B1;
});

sendRes({
  original_b1_ufos: original_b1_ufos,
  new_b1_ufos: new_b1_ufos
});
