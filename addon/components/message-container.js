import Ember from 'ember';
import layout from '../templates/components/message-container';

const {
  Component,
  inject: {
    service: injectService,
  },
  get,
  computed,
  A: emberArray,
  ArrayProxy,
} = Ember;


export default Component.extend({
  layout,

  classNames: ['message-container'],

  messageQueue: injectService(),

  groupClass: 'alert',

  groupTypeClassPrefix: 'alert-',


  messages: computed(function() {
    return ArrayProxy.create({ content: emberArray([]) });
  }).readOnly(),


  sortedMessages: computed('messages.[]', 'messageQueue.messageTypeOrderArray.[]', function() {
    return get(this, 'messageQueue').prepareForComponent(get(this, 'messages'));
  }).readOnly(),


  didInsertElement() {
    get(this, 'messageQueue').registerContainer(this);
    this._super(...arguments);
  },


  willDestroyElement() {
    get(this, 'messageQueue').unregisterContainer(this);
    this._super(...arguments);
  },
});
