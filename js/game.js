var game = {
    data: {
        score: 0,
        steps: 0,
        start: false,
        newHiScore: false,
        muted: false,
        // Custom audio: arrays of Audio elements, with current index for sequential play
        customAudio: {
            wing: { list: [], idx: 0 },
            hit: { list: [], idx: 0 },
            lose: { list: [], idx: 0 }
        },
        // Custom sprite size
        customSpriteSize: null  // {w, h} or null
    },

    resources: [
        // images
        { name: "bg", type: "image", src: "data/img/bg.png" },
        { name: "clumsy", type: "image", src: "data/img/clumsy.png" },
        { name: "pipe", type: "image", src: "data/img/pipe.png" },
        { name: "logo", type: "image", src: "data/img/logo.png" },
        { name: "ground", type: "image", src: "data/img/ground.png" },
        { name: "gameover", type: "image", src: "data/img/gameover.png" },
        { name: "gameoverbg", type: "image", src: "data/img/gameoverbg.png" },
        { name: "hit", type: "image", src: "data/img/hit.png" },
        { name: "getready", type: "image", src: "data/img/getready.png" },
        { name: "new", type: "image", src: "data/img/new.png" },
        { name: "share", type: "image", src: "data/img/share.png" },
        { name: "tweet", type: "image", src: "data/img/tweet.png" },
        // sounds
        { name: "hit", type: "audio", src: "data/sfx/" },
        { name: "lose", type: "audio", src: "data/sfx/" },
        { name: "wing", type: "audio", src: "data/sfx/" },

    ],

    /**
     * Play a sound — uses custom audio list (sequential, looping) if available,
     * otherwise falls back to melonJS audio.
     */
    playSound: function (name) {
        var channel = game.data.customAudio[name];
        if (channel && channel.list.length > 0) {
            console.log('[playSound] Playing custom sound "' + name + '" index ' + channel.idx + '/' + channel.list.length);
            var audio = channel.list[channel.idx];
            var clone = audio.cloneNode();
            clone.volume = audio.volume;
            clone.play().then(function () {
                console.log('[playSound] Custom sound "' + name + '" started playing');
            }).catch(function (e) {
                console.error('[playSound] Failed to play custom sound "' + name + '":', e);
            });
            channel.idx = (channel.idx + 1) % channel.list.length;
        } else {
            console.log('[playSound] Using default melonJS sound for "' + name + '"');
            me.audio.play(name);
        }
    },

    /**
     * Load custom assets from localStorage after melonJS resources are ready.
     */
    loadCustomAssets: function () {
        // -- Custom bird sprite --
        var birdData = localStorage.getItem('customBirdSprite');
        if (birdData) {
            var img = new Image();
            img.src = birdData;
            img.onload = function () {
                me.loader.getImage('clumsy').src = birdData;
            };
        }

        // -- Custom sprite size --
        try {
            var sizeStr = localStorage.getItem('customBirdSize');
            if (sizeStr) {
                game.data.customSpriteSize = JSON.parse(sizeStr);
            }
        } catch (e) { }

        // -- Custom sounds (multi-voice arrays) --
        var soundKeys = {
            wing: 'customSounds_wing',
            hit: 'customSounds_hit',
            lose: 'customSounds_lose'
        };
        for (var sndName in soundKeys) {
            try {
                var raw = localStorage.getItem(soundKeys[sndName]);
                console.log('[loadCustomAssets] Checking ' + sndName + ' (' + soundKeys[sndName] + '): ' + (raw ? raw.length + ' bytes' : 'not found'));
                if (raw) {
                    var arr = JSON.parse(raw);
                    console.log('[loadCustomAssets] Parsed ' + sndName + ': ' + arr.length + ' sound(s)');
                    if (arr && arr.length > 0) {
                        var audioList = [];
                        for (var i = 0; i < arr.length; i++) {
                            var dataUrl = typeof arr[i] === 'string' ? arr[i] : arr[i].data;
                            if (dataUrl && dataUrl.indexOf('data:') === 0) {
                                var a = new Audio(dataUrl);
                                a.volume = 0.5;
                                audioList.push(a);
                                console.log('[loadCustomAssets] Created Audio for ' + sndName + ' #' + i + ' (' + dataUrl.substring(0, 50) + '...)');
                            } else {
                                console.warn('[loadCustomAssets] Invalid data URL for ' + sndName + ' #' + i);
                            }
                        }
                        if (audioList.length > 0) {
                            game.data.customAudio[sndName] = { list: audioList, idx: 0 };
                            console.log('[loadCustomAssets] Loaded ' + audioList.length + ' custom ' + sndName + ' sound(s)');
                        }
                    }
                }
            } catch (e) {
                console.error('[loadCustomAssets] Error loading ' + sndName + ':', e);
            }
        }
    },

    "onload": function () {
        if (!me.video.init(900, 600, {
            wrapper: "screen",
            scale: "auto",
            scaleMethod: "fit"
        })) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }
        me.audio.init("mp3,ogg");
        me.loader.preload(game.resources, this.loaded.bind(this));
    },

    "loaded": function () {
        // Load custom assets from localStorage
        game.loadCustomAssets();

        me.state.set(me.state.MENU, new game.TitleScreen());
        me.state.set(me.state.PLAY, new game.PlayScreen());
        me.state.set(me.state.GAME_OVER, new game.GameOverScreen());

        me.input.bindKey(me.input.KEY.SPACE, "fly", true);
        me.input.bindKey(me.input.KEY.M, "mute", true);
        me.input.bindPointer(me.input.KEY.SPACE);

        me.pool.register("clumsy", game.BirdEntity);
        me.pool.register("pipe", game.PipeEntity, true);
        me.pool.register("hit", game.HitEntity, true);
        me.pool.register("ground", game.Ground, true);

        me.state.change(me.state.MENU);
    }
};
