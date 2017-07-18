import Ember from 'ember';

import {
  test,
  moduleFor,
} from 'ember-qunit';


const {
  typeOf,
  Object: emberObject,
  computed,
  get,
  set,
  ArrayProxy,
  A: emberArray,
  guidFor,
  run,
} = Ember;


const DEFAULT_MSG = 'Hello World 1';
const DEFAULT_MSGS = ['Hello World 2', 'Hello World 3'];

const createComparisionRecord = function(id, msg, type = 'info', target = 0, lifespan = 1, wait = 1) {
  return {
    id,
    msg,
    type,
    target,
    lifespan,
    wait,
  };
};


const getQueue = function(s) {
  return s.get('transitionQueue');
};


const getInstances = function(s) {
  return s.get('containerRegistry');
};


const dummyContainer = emberObject.extend({
  id: computed(function() {
    return guidFor(this);
  }),

  messages: computed(function() {
    return ArrayProxy.create({ content: emberArray([]) });
  }),
});


moduleFor('service:message-queue', "Unit - MessageQueueService");


test('registerContainer and unregisterContainer methods', function(assert) {
  assert.expect(7);

  const instances = getInstances(this.subject());
  const that = this;

  const instA = dummyContainer.create();
  const instB = dummyContainer.create();
  const instC = dummyContainer.create();

  set(this.subject(), 'transferOnUnregister', true);

  this.subject().registerContainer(instA);
  this.subject().registerContainer(instB);
  this.subject().registerContainer(instC);

  assert.deepEqual(
    instances.mapBy('id'),
    [get(instC, 'id'), get(instB, 'id'), get(instA, 'id')],
    'Three message containers have been registered'
  );

  this.subject().add(DEFAULT_MSG);

  assert.equal(
    get(instC, 'messages.firstObject.msg'),
    DEFAULT_MSG,
    'The last message container has received a record'
  );

  run(function() {
    that.subject().unregisterContainer(instC);
  });

  assert.deepEqual(
    instances.mapBy('id'),
    [get(instB, 'id'), get(instA, 'id')],
    'One message container has been un-registered'
  );

  assert.equal(
    get(instB, 'messages.firstObject.msg'),
    DEFAULT_MSG,
    'The record has been transferred to the next available container (transferOnUnregister = true)'
  );

  set(this.subject(), 'transferOnUnregister', false);

  this.subject().unregisterContainer(instB);

  assert.deepEqual(
    instances.mapBy('id'),
    [get(instA, 'id')],
    'One message container has been un-registered'
  );

  assert.equal(
    get(instA, 'messages.firstObject.msg'),
    undefined,
    'The record was not transferred to the next available container (transferOnUnregister = false)'
  );

  this.subject().unregisterContainer(instA);

  assert.equal(get(instances, 'length'), 0, 'All messages containers have been un-registered');
});


test('queue and unqueue methods', function(assert) {
  assert.expect(6);

  const queue = getQueue(this.subject());
  const id = this.subject().queue(DEFAULT_MSG);

  assert.equal(typeOf(id), 'string', 'A string ID has been returned');

  assert.deepEqual(
    queue.objectAt(0),
    createComparisionRecord(id, DEFAULT_MSG),
    'The message record has been properly stored in the queue'
  );


  const ids = this.subject().queue(DEFAULT_MSGS);

  assert.equal(typeOf(ids), 'array', 'An array of IDs has been returned');

  assert.deepEqual(
    queue.objectAt(1),
    createComparisionRecord(ids[0], DEFAULT_MSGS[0]),
    'The message record has been properly stored in the queue'
  );

  assert.deepEqual(
    queue.objectAt(2),
    createComparisionRecord(ids[1], DEFAULT_MSGS[1]),
    'The message record has been properly stored in the queue'
  );

  this.subject().unqueue(id);

  assert.deepEqual(queue.mapBy('id'), ids, 'The message has been properly unqueued');
});


test('add and remove methods', function(assert) {
  assert.expect(0);
});