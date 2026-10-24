import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.js';
import { errMsg } from './utils.js';

const call = (name) => async (data) => {
  try { return (await httpsCallable(functions, name)(data)).data; }
  catch (e) { throw new Error(errMsg(e)); }
};
export const placeOrder = call('sfPlaceOrder');
