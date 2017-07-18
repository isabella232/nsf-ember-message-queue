import Ember from 'ember';

const {
  Controller,
  inject: {
    service: injectService,
  },
  computed,
  isEmpty,
  get,
  set,
  getProperties,
  setProperties,
} = Ember;


export default Controller.extend({
  messages: injectService('message-queue'),

  messageText: null,

  messageType: '',

  triggerType: 'transition',

  targetContainer: '0',

  lifespan: '1',

  waitTime: '1',

  updateExisting: true,

  clearExisting: false,


  messagePlaceholder: computed('messageType', 'triggerType', 'targetContainer',
    'lifespan', 'waitTime', 'updateExisting', 'clearExisting', function() {
      const {
        messageType,
        triggerType,
        targetContainer,
        lifespan,
        waitTime,
        updateExisting,
        clearExisting,
      } = getProperties(this, 'messageType', 'triggerType', 'targetContainer',
        'lifespan', 'waitTime', 'updateExisting', 'clearExisting');

      let text = `Type: "${messageType}"; Trigger: "${triggerType}"; Target: ${targetContainer}; Lifespan: ${lifespan};`;

      if (triggerType === 'transition') {
        text = `${text} Wait: ${waitTime};`;
      }
      else {
        text = `${text} Update: ${updateExisting}; Clear: ${clearExisting};`;
      }

      return text;
  }).readOnly(),


  areTransitionOptionsDisabled: computed('triggerType', function() {
    return get(this, 'triggerType') !== 'transition';
  }).readOnly(),


  areNowOptionsDisabled: computed.not('areTransitionOptionsDisabled'),


  resetController() {
    setProperties(this, {
      messageText: null,
      messageType: '',
      triggerType: 'transition',
      targetContainer: '0',
      lifespan: '1',
      waitTime: '1',
      updateExisting: true,
      clearExisting: false,
    });
  },


  actions: {
    addMessage() {
      if (get(this, 'isAddButtonDisabled')) {
        return;
      }

      const {
        messageText,
        messagePlaceholder,
        messageType,
        triggerType,
        targetContainer,
        lifespan,
        waitTime,
        updateExisting,
        clearExisting,
      } = getProperties(this, 'messageText', 'messagePlaceholder', 'messageType', 'triggerType', 'targetContainer',
        'lifespan', 'waitTime', 'updateExisting', 'clearExisting');

      const props = {
        lifespan,
        type: messageType,
        target: targetContainer,
        wait: waitTime,
        update: updateExisting,
        clear: clearExisting,
      };

      const text = isEmpty(messageText) ? messagePlaceholder : messageText;

      if (triggerType === 'now') {
        get(this, 'messages').add(text, props);
      }
      else {
        get(this, 'messages').queue(text, props);
      }

      set(this, 'messageText', null);
    },
  },
});
