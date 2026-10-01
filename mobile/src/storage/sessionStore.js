const SecureStore = require('expo-secure-store');

const TOKEN_KEY = 'yordanup.access-token';

const sessionStore = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  saveToken: token => SecureStore.setItemAsync(TOKEN_KEY, token),
  clearToken: () => SecureStore.deleteItemAsync(TOKEN_KEY)
};

module.exports = { sessionStore, TOKEN_KEY };
