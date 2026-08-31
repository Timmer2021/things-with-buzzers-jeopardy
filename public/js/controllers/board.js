'use strict';

angular.module('myApp.controllers').
  controller('BoardCtrl', function ($scope, $timeout, $modal, socket, currencyFilter) {
    socket.emit('board:init');

    socket.on('board:init', function (data) {
      if (data) {
        $scope.data = data.data;
        $scope.game = data.game;
        $scope.scoreHtml = buildScores();
        $scope.scoreHtmlTop = buildScoresTop();
      }
    });

    // --- CATCH BUZZER VERDICT, WIPE SCREEN, & PLAY SOUND ON INCORRECT ---
    socket.on('buzzer:verdict', function (data) {
      console.log(">>> BOARD CAUGHT BUZZER VERDICT:", data);
      
      if (window.buzzerInterval) {
        clearInterval(window.buzzerInterval);
        window.buzzerInterval = null;
      }

      var el = document.getElementById("button-hit");
      if (el) {
        el.style.visibility = "hidden";
        el.style.display = "none";
        el.innerText = "";
      }

      // If the verdict action is incorrect (X button), play the timesup audio
      if (data && data.action === 'incorrect') {
        var timesUpAudio = window.timesUpAudio || new Audio('/audio/timesup.mp3');
        window.timesUpAudio = timesUpAudio;
        timesUpAudio.currentTime = 0;
        timesUpAudio.play().catch(function(err) {
          console.log("Audio play blocked: ", err);
        });
      }
    });

    function buildScores () {
      var count = 3;
      var width = 4;
      var buffer = "";

      if($scope.game.player_4 && $scope.game.player_4.name) {
        count = 4;
        width = 3;

        if($scope.game.player_5 && $scope.game.player_5.name) {
          count = 5;
          width = 2;
          buffer = '<div class="col-md-1 text-center"> </div>'
        }
      }

      var returnValue = '<div class="row">' + buffer;

      for(var i = 1; i <= count; i++) {
        var key = "player_" + i;
        returnValue += '<div class="col-md-' + width + ' text-center">' +
          '<div class="player-name">' +
            (($scope.game[key] && $scope.game[key].name) || 'Player ' + i) +
          '</div><div class="player-score">' +
            currencyFilter(($scope.game[key] && $scope.game[key].score) || 0, '$', 0) +
          '</div>' +
        '</div>';
      }

      returnValue +=  '</div>';

      return returnValue;
    }

    function buildScoresTop() {
      var count = 3;
      var width = 4;
      var buffer = "";

      if($scope.game.player_4 && $scope.game.player_4.name) {
        count = 4;
        width = 3;

        if($scope.game.player_5 && $scope.game.player_5.name) {
          count = 5;
          width = 2;
          buffer = '<div class="col-md-1 text-center"> </div>'
        }
      }

      var returnValue = '<div class="row">' + buffer;

      for(var i = 1; i <= count; i++) {
        var key = "player_" + i;
        returnValue += '<div class="col-md-' + width + ' text-center">' +
            (($scope.game[key] && $scope.game[key].name) || 'Player ' + i) + ": " + currencyFilter(($scope.game[key] && $scope.game[key].score) || 0, '$', 0) +
        '</div>';
      }

      returnValue +=  '</div>';

      return returnValue;
    }

    socket.on('round:start', function (data) {
      $scope.data = data.data;
      $scope.game = data.game;
      $scope.scoreHtmlTop = buildScoresTop();

      if (modalInstance) {
        modalInstance.close();
      }

      if (data.game.round === 'DJ') {
        openModal();
        $timeout(modalInstance.close, 5000);
      }
      else if (data.game.round === 'FJ') {
        $scope.scoreHtml = buildScores();
      }
      else if (data.game.round === 'end') {
        openModal();
      }
    });

    var modalInstance;
    function openModal (id) {
      if (modalInstance) {
        modalInstance.close();
      }

      modalInstance = $modal.open({
        templateUrl: 'partials/boardclue',
        controller: 'BoardClueCtrl',
        backdrop: 'static',
        size: 'lg',
        openedClass: 'board-modal-open',
        resolve: {
          response: function () {
            return {
              id: id,
              clue: $scope.data[id],
              game: $scope.game,
              scoreHtml: buildScores(),
              scoreHtmlTop: buildScoresTop()
            };
          }
        }
      });
    };

    socket.on('clue:start', function (data) {
      openModal(data);
    });

    socket.on('clue:end', function (data) {
      $scope.game = data;
      if (modalInstance) {
        modalInstance.close();
      }
      $scope.scoreHtmlTop = buildScoresTop();
    });

    var wsURL = (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host + "/stream"
    console.log("Connecting to Jeopardy game websocket server " + wsURL);
    connectToWebSocket(wsURL);
  });

var lastHit = 0;
var currentTime;

function connectToWebSocket(websocketServerLocation){
  var ws = new WebSocket(websocketServerLocation);

  ws.onopen = function(evt) {
    console.log("WebSocket -> Jeopardy game server: Connection established");
  }
  ws.onerror = function(evt) {
    console.log("WebSocket -> Jeopardy game server: Error -> ", evt);
  }
  ws.onclose = function(){
    console.log("WebSocket -> Jeopardy game server: Connection closed ... Try to reconnect");
    setTimeout(function(){connectToWebSocket(websocketServerLocation)}, 5000);
  }

  ws.onmessage = function(evt) {
    var message = JSON.parse(evt.data);
    console.log("WebSocket message received:", message);

    var buttonColor = message.Color;
    if (!buttonColor || buttonColor === 'grey' || buttonColor === 'gray') return;

    var el = document.getElementById("button-hit");
    if (!el) return;

    el.style.backgroundColor = buttonColor;
    el.style.visibility = "visible";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.fontSize = "60px";
    el.style.fontWeight = "bold";
    el.style.color = (buttonColor === "yellow" || buttonColor === "white") ? "black" : "white";

    var timeLeft = 15;
    el.innerText = timeLeft;

    if (window.buzzerInterval) clearInterval(window.buzzerInterval);
    
    var timesUpAudio = window.timesUpAudio || new Audio('/audio/timesup.mp3');
    window.timesUpAudio = timesUpAudio;

    window.buzzerInterval = setInterval(function() {
      timeLeft--;
      if (timeLeft > 0) {
        el.innerText = timeLeft;
      } else {
        clearInterval(window.buzzerInterval);
        window.buzzerInterval = null;
        el.style.visibility = "hidden";
        el.innerText = "";
        
        timesUpAudio.currentTime = 0;
        timesUpAudio.play().catch(function(err) {
          console.log("Audio play blocked: ", err);
        });
      }
    }, 1000);
  }
}
