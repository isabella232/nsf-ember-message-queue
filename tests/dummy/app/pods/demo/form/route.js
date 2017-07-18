import Ember from 'ember';

const {
  Route,
} = Ember;


export default Route.extend({
  resetController(controller, isExiting) {
    if (isExiting) {
      controller.resetController();
    }
  }
});
