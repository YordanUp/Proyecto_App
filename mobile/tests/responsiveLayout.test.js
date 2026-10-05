const test = require('node:test');
const assert = require('node:assert/strict');
const { tabBarMetrics, keyboardAvoidingBehavior } = require('../src/services/layout');

test('MOB-UI-001: reserva el inset inferior del sistema para la barra de navegación', () => {
  assert.deepEqual(tabBarMetrics(0), { height: 59, paddingTop: 7, paddingBottom: 7 });
  assert.deepEqual(tabBarMetrics(24), { height: 83, paddingTop: 7, paddingBottom: 24 });
  assert.deepEqual(tabBarMetrics(-1), { height: 59, paddingTop: 7, paddingBottom: 7 });
});

test('MOB-UI-002: el teclado usa ajuste padding en iOS y el modo pan del sistema en Android', () => {
  assert.equal(keyboardAvoidingBehavior('ios'), 'padding');
  assert.equal(keyboardAvoidingBehavior('android'), undefined);
});
