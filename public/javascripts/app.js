var global = this;

$(function () {
  var controller = new Controller();

  var players = global.players = {
    youtube:    new Player.YouTube(),
    soundcloud: new Player.SoundCloud(),
    audioTag:   new Player.AudioTag()
  };

  /*
  controller.loop(function (track) {
    console.log(track);
    var player = players[track.type];
    if (player) {
      return player.play(track);
    }
  });
  */
});

// Controller {{{
function Controller () {
}

Controller.prototype.dequeue = function () {
  return $.ajax(
    '/dequeue', {
      type: 'POST',
      dataType: 'json'
    }
  );
};

Controller.prototype.loop = function (play) {
  var controller = this;
  var next = function () {
    controller.dequeue().done(function (track) {
      if (!track) {
        setTimeout(next, 2000);
        return;
      }
      var d = play(track);
      if (d) {
        d.always(next);
      } else {
        console.log('Could not play: ' + track.url);
        next();
      }
    });
  };
  next();
};
// }}}

// Player {{{
function Player () {
  this.deferreds = {};
}

Player.prototype = {
  play: function (track) {
    // cancel previous play
    if (this.deferreds['play']) {
      this.deferreds['play'].reject();
    }

    var self = this;
    this.prepare(track).done(function () { self._play(track) });

    return this.deferreds['play'] = $.Deferred();
  },
  playEnded: function () {
    if (this.deferreds['play']) {
      this.deferreds['play'].resolve();
    }
  },
  prepare: function (track) {
    return this.deferreds['prepare'] = this.deferreds['prepare'] || this._prepare(track);
  },
  _prepare: function () {
    var d = $.Deferred();
    d.resolve();
    return d;
  }
};
// }}}

// YouTube {{{
// https://developers.google.com/youtube/iframe_api_reference
Player.YouTube = function () {
  this.PLAYER_PLACEHOLDER_ID = 'player-youtube-placeholder';
  Player.call(this);
};

Player.YouTube.prototype = $.extend(
  new Player, {
    _play: function (track) {
      this.player.loadVideoById(track.videoId);
    },
    _prepare: function (track) {
      var d = $.Deferred();

      $.getScript('//www.youtube.com/iframe_api');

      $('<div/>', { id: this.PLAYER_PLACEHOLDER_ID }).appendTo(document.body);

      var youtube = this;
      window.onYouTubeIframeAPIReady = function () {
        youtube.player = new YT.Player(youtube.PLAYER_PLACEHOLDER_ID, {
          videoId: track.videoId,
          events: {
            onReady: function () {
              d.resolve();
            },
            onStateChange: function (e) {
              if (e.data === YT.PlayerState.ENDED) {
                youtube.playEnded();
              }
            }
          }
        });
      };

      return d;
    },
    extractVideoId: function (url) {
      return url.match(/[\?&]v=([^&]+)/)[1];
    }
  }
);
// }}}

// SoundCloud {{{
// http://developers.soundcloud.com/docs#playing
// http://developers.soundcloud.com/docs/api/html5-widget
Player.SoundCloud = function () {
  this.PLAYER_IFRAME_ID = 'player-soundcloud-iframe';
  this.CLIENT_ID = '98365098cb72a68cf93fda1fcebf48e8';
  Player.call(this);
};

Player.SoundCloud.prototype = $.extend(
  new Player(), {
    _play: function (track) {
      var url = track.url;
      var soundcloud = this;
      console.log('embed ' + url);
      SC.oEmbed(url, { auto_play: true }, function (oEmbed) {
        var iframe = $(oEmbed.html).appendTo(document.body);
        if (!iframe.is('iframe')) {
          console.log('got no iframe', iframe);
        }
        var widget = SC.Widget(iframe.get(0));
        widget.bind(
          SC.Widget.Events.FINISH,
          function () { soundcloud.playEnded() }
        );
      });
    },
    _prepare: function () {
      return $.when(
        $.getScript('http://connect.soundcloud.com/sdk.js'),
        $.getScript('http://w.soundcloud.com/player/api.js')
      );
    }
  }
);
// }}}

// AudioTag {{{
Player.AudioTag = function () {
  Player.call(this);
};

Player.AudioTag.prototype = $.extend(
  new Player(), {
    _play: function (track) {
      var url = track.url;
      var audioTag = this;
      var audio = $('<audio controls autoplay/>')
        .attr('src', url)
        .appendTo(document.body)
        .bind('ended', function () {
          console.log('ended');
          audioTag.playEnded();
        });
    }
  }
);
// }}}
