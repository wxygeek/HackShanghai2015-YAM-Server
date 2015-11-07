'use strict';

var router = require('../router').router;
var utils = require('../utils');
var urllib = require('urllib');
var moment = require('moment');
var db = require('../db');

var smsRules = [{
  rule: /一起/,
  yes: '好的，不见不散。',
  no: '抱歉，我那段时间有安排了。'
}];

var namePriorities = [{
  name: 'Chancellor Yu',
  rule: /\+8615704600640/,
  priority: 100,
  picKey: 'ylz.jpg'
}, {
  name: 'Sarah',
  rule: /\+8615945990589/,
  priority: -1,
  picKey: 'sarah.jpg'
}];

var getTuringResult = function*(text) {
  var url = "http://www.tuling123.com/openapi/api?key=e0656ec0047415e904401d40987b9d81&info=" + encodeURIComponent(text);
  var result = yield urllib.requestThunk(url, {
    dataType: 'json'
  });
  return result.data.text;
};

var getNLPTimeResult = function*(text) {

  var url = "http://ltpapi.voicecloud.cn/analysis/?api_key=M3n7l5b3AkKTiM6hkitETCMkxsphEzZhRwGQ6Jhw&pattern=all&format=json&text=" + encodeURIComponent(text);

  var result = yield urllib.requestThunk(url, {
    method: 'GET',
    dataType: 'json'
  });
  result = result.data;

  var time = moment();
  result = result[0][0];
  result.filter(function(elm) {
    return elm.pos === 'nt';
  }).forEach(function(elm) {
    var content = elm.cont;
    switch (content) {
      case '明天':
        time = time.set('date', time.get('date') + 1);
        break;
      case '后天':
        time = time.set('date', time.get('date') + 2);
        break;
      case '大后天':
        time = time.set('date', time.get('date') + 3);
        break;
      case '明年':
        time = time.set('year', 2016);
        break;
      case '后年':
        time = time.set('year', 2017);
        break;
      case '大后年':
        time = time.set('year', 2018);
        break;
      case '一月':
        time = time.set('month', 1);
        break;
      case '二月':
        time = time.set('month', 2);
        break;
      case '三月':
        time = time.set('month', 3);
        break;
      case '四月':
        time = time.set('month', 4);
        break;
      case '五月':
        time = time.set('month', 5);
        break;
      case '六月':
        time = time.set('month', 6);
        break;
      case '七月':
        time = time.set('month', 7);
        break;
      case '八月':
        time = time.set('month', 8);
        break;
      case '九月':
        time = time.set('month', 9);
        break;
      case '十月':
        time = time.set('month', 10);
        break;
      case '十一月':
        time = time.set('month', 11);
        break;
      case '十二月':
        time = time.set('month', 12);
        break;
    }
    if (/^\d{1,2}月$/.test(content)) {
      time = time.set('month', parseInt(content));
    } else if (/^\d{1,2}日$/.test(content)) {
      time = time.set('date', parseInt(content));
    }
  });

  var regResult = /\d{1,2}:\d{1,2}/.exec(text);
  if (regResult) {
    time = time.set('hour', regResult[0].split(':')[0]);
    time = time.set('minute', regResult[0].split(':')[1]);
  }

  return time;
};

var count = 0;

router.get('/get', function*() {
  if(count + 1 >= db.storage.length) {
    count = 0;
  } else {
    count++;
  }

  this.body = db.storage[count];
});


router.post('/sms', function*() {
  var text = this.request.body.text;
  var phone = this.request.body.phone;

  var obj = {
    title: text,
    autoReply: {
      flag: true,
      content: "",
      phone: phone
    },
    autoCalendar: {
      flag: false,
      time: "",
      content: "",
      place: ""
    },
    hasCountDown: true,
    yesBtnText: "自动处理",
    noBtnText: "手动处理"
  };

  var time = yield getNLPTimeResult(text);
  obj.autoCalendar.time = time.unix();

  var currentSmsRule = null;
  for (var i = 0; i < smsRules.length; i++) {
    var rule = smsRules[i];
    if (rule.rule.test(text)) {
      currentSmsRule = rule;
      break;
    }
  }

  var currentName = null;
  for (var i = 0; i < namePriorities.length; i++) {
    var rule2 = namePriorities[i];
    if (rule2.rule.test(phone)) {
      obj.autoReply.phone = "-1";
      currentName = rule2;
      break;
    }
  }

  if(currentSmsRule) {
    if(!currentName || currentName.priority > 0) {
      obj.autoReply.content = currentSmsRule.yes;
    } else {
      obj.autoReply.content = currentSmsRule.no;
    }
  } else {
    // Turing
    obj.autoReply.content = yield getTuringResult(text);
  }

  var name = currentName ? currentName.name : phone;

  obj.description = "来自 " + name + " [SMS]\n自动回复：" + obj.autoReply.content;

  if (obj.autoCalendar.flag) {
    obj.description += "\n加入日程：";
  }

  obj.picUrl = utils.getFileUrl(currentName ? currentName.picKey : 'default.jpg');

  this.body = obj;
});