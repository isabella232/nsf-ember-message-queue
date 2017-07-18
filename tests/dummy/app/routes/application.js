import Ember from 'ember';

const {
  Route,
  inject,
  set,
} = Ember;


export default Route.extend({
  messageQueue: inject.service('message-queue'),

  init() {
    set(this, 'messageQueue.messageTypeOrder', 'danger, warning, success, info');
  },
});
