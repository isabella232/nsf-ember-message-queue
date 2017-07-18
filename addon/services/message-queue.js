import Ember from 'ember';

const {
  Service,
  computed,
  A: emberArray,
  ArrayProxy,
  get,
  inject: {
    service: injectService,
  },
  isArray,
  guidFor,
  set,
  typeOf,
  run: {
    schedule,
  },
} = Ember;


export default Service.extend({
  router: injectService('-routing'),


  init() {
    this._super(...arguments);
    get(this, 'router.router').on('didTransition', this, this._routerDidTransition);
  },


  /**
   * The category that will be given to a message if no type is specified.
   *
   * @property defaultMessageType
   * @type String
   * @default "info"
   * @public
   */
  defaultMessageType: 'info',


  /**
   * An array or comma delimited string of possible message types in the order that
   * they should be displayed in when rendered.
   *
   * @property messageTypeOrder
   * @type Array|String
   * @default null
   * @public
   */
  messageTypeOrder: null,


  /**
   * If true, then any messages currently being displayed in a message-container when
   * it is un-registered from this service will be transferred to the next available
   * container.
   *
   * @property transferOnDestroy
   * @type Boolean
   * @default false
   */
  transferOnUnregister: true,


  /**
   * A to-array version of `messageTypeOrder`.
   *
   * @property messageTypeOrderArray
   * @type Array
   * @default Array
   * @readonly
   */
  messageTypeOrderArray: computed('messageTypeOrder.[]', function() {
    const messageTypeOrder = get(this, 'messageTypeOrder');

    if (!messageTypeOrder) {
      return [];
    }
    else if (typeOf(messageTypeOrder) === 'string') {
      return messageTypeOrder.split(',').map(item => item.trim());
    }

    return messageTypeOrder;
  }).readOnly(),


  /**
   * An array of message-container component instances.
   *
   * @property containerRegistry
   * @type Ember.ArrayProxy
   * @readonly
   */
  containerRegistry: computed(function() {
    return ArrayProxy.create({ content: emberArray([]) });
  }).readOnly(),


  /**
   * An array of message objects pending creation after some transition.
   *
   * @property transitionRegistry
   * @type Ember.ArrayProxy
   * @readonly
   */
  transitionQueue: computed(function() {
    return ArrayProxy.create({ content: emberArray([]) });
  }).readOnly(),


  /**
   * Queues a message for display on a subsequent transition.
   *
   * @method queue
   * @public
   *
   * @param {String|Array} msg A single string or array of string messages.
   * @param {Object} [options] Optional configuration.
   *  @param {String} [options.type=null] The type, or category, of the message(s).
   *  @param {Integer} [options.target=0] The message-container instance that the
   *  message(s) will be displayed in.
   *  @param {Integer} [options.lifespan]
   * @param {Integer} [options.wait]
   *
   * @returns {String|Array} The unique id or array of ids for the generated
   * message records.
   */
  queue(msg, { type = null, target = 0, lifespan = 1, wait = 1 } = {}) {
    const records = this._createMessageRecords(msg, type, target, lifespan, wait);
    this._addToArray(records, get(this, 'transitionQueue'));
    return this._extractMessageRecordIds(records);
  },


  /**
   * Removes one or more messages from the transition queue. If already removed from the
   * queue, `remove()` will be called to remove the message(s) from their message-container
   * instances.
   *
   * @method unqueue
   * @public
   *
   * @param {String|Array} id
   */
  unqueue(id) {
    const notRemoved = this._removeFromArray(id, get(this, 'transitionQueue'));

    if (notRemoved !== true) {
      this.remove(id);
    }
  },


  /**
   *
   * @method add
   * @public
   *
   * @param msg
   * @param type
   * @param target
   * @param lifespan
   * @param update
   * @param clear
   * @returns {*}
   */
  add(msg, { type = null, target = 0, lifespan = 1, update = true, clear = false } = {}) {
    const records = this._createMessageRecords(msg, type, target, lifespan, 0);
    const instanceIdx = this._getValidInstanceIndex(target);

    this._updateMessageContainer(instanceIdx, records, update, clear);
    return this._extractMessageRecordIds(records);
  },


  /**
   *
   * @method remove
   * @public
   *
   * @param {Array|String} id
   */
  remove(id) {
    const instances = get(this, 'containerRegistry');

    for (let i = 0; i < get(instances, 'length'); i += 1) {
      const notRemoved = this._removeFromArray(id, get(instances, 'messages'));

      if (notRemoved === true) {
        break;
      }
    }
  },


  /**
   *
   * @method prepareForComponent
   * @public
   *
   * @params {Array} records
   */
  prepareForComponent(records) {
    const types = this._sortRecordsByType(records);
    const typeKeys = Object.keys(types);
    const reorder = get(this, 'messageTypeOrderArray');

    let results = [];

    for (let i = 0; i < reorder.length; i += 1) {
      const key = reorder[i];
      const idx = typeKeys.indexOf(key);

      if (idx !== -1) {
        typeKeys.splice(idx, 1);
        results.push({ type: key, messages: types[key].map(record => get(record, 'msg')) });
      }
    }

    if (typeKeys.length) {
      const remaining = typeKeys.sort().map(
        (key) => { return { type: key, messages: types[key].map(record => get(record, 'msg')) } }
      );

      results = results.concat(remaining);
    }

    return results;
  },


  /**
   * Adds a message-container instance to the register if not already there.
   *
   * @method registerContainer
   * @protected
   *
   * @param {Ember.Component} instance
   */
  registerContainer(instance) {
    get(this, 'containerRegistry').unshiftObject(instance);
  },


  /**
   * Removes a message-container instance from the register.
   *
   * @method unregisterContainer
   * @protected
   *
   * @param {Ember.Component} instance
   */
  unregisterContainer(instance) {
    const instances = get(this, 'containerRegistry');
    const idx = instances.indexOf(instance);

    instances.removeObject(instance);

    if (get(this, 'transferOnUnregister')) {
      const messages = get(instance, 'messages').map(item => item);

      if (get(messages, 'length')) {
        schedule('sync', this, function() {
          const newInstance = this._getInstanceByIndex(idx);

          if (newInstance) {
            get(newInstance, 'messages').addObjects(messages);
          }
        });
      }
    }
  },


  /**
   *
   * @method _createMessageRecords
   * @private
   *
   * @param msg
   * @param type
   * @param target
   * @param lifespan
   * @param wait
   *
   * @returns {*|{type: String, msg: String, target: Number, lifespan: Integer, wait: Integer}}
   */
  _createMessageRecords(msg, type, target, lifespan, wait) {
    const msgType = type || get(this, 'defaultMessageType');

    return isArray(msg)
      ? this._createMessageRecordArray(msg, msgType, target, lifespan, wait)
      : this._createMessageRecord(msg, msgType, target, lifespan, wait);
  },


  /**
   *
   * @method _createMessageRecordArray
   * @private
   *
   * @param {String} messages
   * @param {String} type
   * @param {Integer} target
   * @param {Integer} lifespan
   * @param {Integer} wait
   */
  _createMessageRecordArray(messages, type, target, lifespan, wait) {
    return messages.map(
      message => this._createMessageRecord(message, type, target, lifespan, wait)
    );
  },


  /**
   *
   * @method _createMessageRecord
   * @private
   *
   * @param {String} message
   * @param {String} type
   * @param {Integer} target
   * @param {Integer} lifespan
   * @param {Integer} wait
   *
   * @returns {{type: String, msg: String, target: Number, lifespan: Integer, wait: Integer}}
   */
  _createMessageRecord(message, type, target, lifespan, wait) {
    const obj = {
      type,
      msg: message,
      target: parseInt(target, 10),
      lifespan: parseInt(lifespan, 10),
      wait: parseInt(wait, 10),
    };

    obj.id = guidFor(obj);
    return obj;
  },


  /**
   *
   *
   * @method _extractMessageRecordIds
   * @private
   *
   * @param {Array|Object} records
   *
   * @returns {Array|String}
   */
  _extractMessageRecordIds(records) {
    return isArray(records)
      ? records.map(record => get(record, 'id'))
      : get(records, 'id');
  },


  /**
   * Adds one or more message records to the provided array.
   *
   * @method _addToArray
   * @private
   *
   * @param {Array|Object} msgObject A single message object, or an array of
   * multiple message objects.
   * @param {Array} array The array to add the message object(s) to.
   */
  _addToArray(msgObject, array) {
    if (isArray(msgObject)) {
      array.addObjects(msgObject);
    }
    else {
      array.addObject(msgObject);
    }
  },


  /**
   * Given one or more message record ids, removes those records from the provided array.
   *
   * @method _removeFromArray
   * @private
   *
   * @param {Array|String} id A single message record id, or array of message record
   * ids to be removed.
   * @param {Ember.MutableArray} array The array to attempt to remove the record(s) from.
   *
   * @returns {Array|Boolean} A boolean true if all of the meeting records with the
   * provided ids have been removed, or an array of meeting records which were not
   * found in the provided array (and may need to be looked for elsewhere).
   */
  _removeFromArray(id, array) {
    const notFoundIds = [];

    if (isArray(id)) {
      id.forEach((value) => {
        const item = array.findBy('id', value);

        if (item) {
          array.removeObject(item);
        }
        else {
          notFoundIds.push(value);
        }
      });
    }
    else {
      const item = array.findBy('id', id);

      if (item) {
        array.removeObject(item);
      }
      else {
        notFoundIds.push(id);
      }
    }

    return notFoundIds.length ? notFoundIds : true;
  },


  /**
   * Schedules an update for pending messages at the end of the afterRender run
   * queue.
   *
   * @method _routerDidTransition
   * @private
   */
  _routerDidTransition() {
    schedule('afterRender', this, function() {
      this._updateMessageContainers(
        this._pullAdditionsFromQueue()
      );
    });
  },


  /**
   *
   *
   * @method _pullAdditionsFromQueue
   * @private
   *
   * @returns {Object}
   */
  _pullAdditionsFromQueue() {
    const queue = get(this, 'transitionQueue');
    let addsByTarget = {};

    if (get(queue, 'length')) {
      // Drop all wait times by one.
      this._decrementWaitTimes(queue);

      // Gather up all the 0 wait times. Their time has come!
      const additions = queue.filterBy('wait', 0);
      queue.removeObjects(additions);

      addsByTarget = this._sortRecordsByTarget(additions);
    }

    return addsByTarget;
  },


  /**
   * Updates the contents of all registered message-container instances by calling
   * `_updateMessageContainer` for each.
   *
   * @method _updateMessageContainers
   * @protected
   *
   * @param {Object} additions An object created by `_sortRecordsByType()`.
   * @param {Boolean} [update=true] A boolean indicating whether or not any current
   * messages in the instance should have their lifecycle properties updated, possible
   * removing some/all.
   * @param {Boolean} [clear=false] A boolean indicating whether or not all current
   * messages in the instance should be cleared.
   */
  _updateMessageContainers(additions, update = true, clear = false) {
    get(this, 'containerRegistry').forEach((instance, idx) => {
      this._updateMessageContainer(instance, additions[`${idx}`], update, clear);
    });
  },


  /**
   * Updates the contents of a single message-container instance.
   *
   * @method _updateMessageContainer
   * @protected
   *
   * @param {Ember.Component} instance The message-container instance to update.
   * @param {Array} additions An array of message records to add to the instance.
   * @param {Boolean} [update=true] A boolean indicating whether or not any current
   * messages in the instance should have their lifecycle properties updated, possible
   * removing some/all.
   * @param {Boolean} [clear=false] A boolean indicating whether or not all current
   * messages in the instance should be cleared.
   */
  _updateMessageContainer(instance, additions, update = true, clear = false) {
    const componentInstance = this._getInstanceByIndex(instance);
    const messages = get(componentInstance, 'messages');

    if (clear) {
      messages.clear();
    }
    else if (get(messages, 'length') && update) {
      this._decrementLifespans(messages);

      messages.removeObjects(
        messages.filterBy('lifespan', 0)
      );
    }

    if (additions) {
      this._addToArray(additions, messages);
    }
  },


  /**
   * Given an array of message records, an object will be returned in which each
   * enumerable property will be an array containing records which share a target.
   *
   * @method _sortRecordsByTarget
   * @protected
   *
   * @param {Array} records
   * @returns {Object}
   */
  _sortRecordsByTarget(records) {
    return this._groupByCommonProperty(records, 'target');
  },


  /**
   * Given an array of message records, an object will be returned in which each
   * enumerable property will be an array containing records which share a type.
   *
   * @method _sortRecordsByType
   * @protected
   *
   * @param {Array} records
   * @returns {Object}
   */
  _sortRecordsByType(records) {
    return this._groupByCommonProperty(records, 'type');
  },


  /**
   * Decrease the `wait` integer on each message record in the provided array
   * by 1.
   *
   * @property _decrementWaitTimes
   * @private
   *
   * @param {Array} records
   */
  _decrementWaitTimes(records) {
    records.forEach((record) => {
      const wait = get(record, 'wait');
      set(record, 'wait', wait - 1);
    });
  },


  /**
   * Decrease the `lifespan` integer on each message record in the provided array
   * by 1.
   *
   * @property _decrementLifespans
   * @private
   *
   * @param {Array} records
   */
  _decrementLifespans(records) {
    records.forEach((record) => {
      const lifespan = get(record, 'lifespan');
      set(record, 'lifespan', lifespan - 1);
    });
  },


  /**
   * Given a proposed message-container target index, this will return
   * the closest available component that is currently registered or null
   * if no components are registered.
   *
   * @method _getInstanceByIndex
   * @private
   *
   * @param {Integer|String|Ember.Component} idx
   *
   * @returns {null|Ember.Component}
   */
  _getInstanceByIndex(idx) {
    if (typeOf(idx) === 'instance') {
      return idx;
    }

    const instanceIdx = this._getValidInstanceIndex(idx);

    if (instanceIdx === null) {
      return null;
    }

    return get(this, 'containerRegistry').objectAt(instanceIdx);
  },


  /**
   * Given a proposed message-container target index, this will return
   * a valid index corresponding to the closest available component
   * that is currently registered or null if no components are registered.
   *
   * @method _getValidInstanceIndex
   * @private
   *
   * @param {Integer|String} proposedIdx
   *
   * @returns {null|Integer}
   */
  _getValidInstanceIndex(proposedIdx) {
    const idx = parseInt(proposedIdx, 10);
    const length = get(this, 'containerRegistry.length');

    if (length === 0 || isNaN(idx)) {
      return null;
    }
    else if (idx >= 0 && idx < length) {
      return idx;
    }
    else if (idx < 0) {
      return 0;
    }

    return length - 1;
  },


  /**
   * Given an array of message records, an object will be returned in which each
   * enumerable property will be an array containing records which share the given
   * `commonProp` value.
   *
   * @method _groupByCommonProperty
   * @private
   *
   * @param {Array} array
   * @param {String} commonProp
   *
   * @returns {Object}
   */
  _groupByCommonProperty(array, commonProp) {
    const results = {};

    array.forEach((record) => {
      const val = get(record, commonProp).toString();

      if (!get(results, val)) {
        results[val] = [];
      }

      results[val].push(record);
    });

    return results;
  }
});
