var express             = require("express"),
    app                 = express(),
    electricity         = require("electricity"),
    http                = require("http").Server(app),
    io                  = require("socket.io")(http),
    mustacheExpress     = require("mustache-express"),
    strip               = require("strip"),
    bbcode              = require("bbcode").parse,
    md                  = require("markdown").markdown.toHTML,
    _                   = require("lodash"),
    request             = require("request"),
    async               = require("async");

var strings             = require("./strings.json");

// Serve public files
app.use("/", electricity.static(__dirname + "/public"));
app.use("/bc", express.static(__dirname + "/bower_components"));

// Setup Mustache
app.engine("html", mustacheExpress());
app.set("view engine", "mustache");
app.set("views", __dirname + "/views");

// Electricity URL support for Mustache
app.use(function(req, res, next) {
    req.app.locals.eURL = function() {
        return function(text) {
            return req.app.locals.electricity.url(text);
        };
    };
    next();
});

// Expose strings.js to Mustache renderer
app.use(function(req, res, next) {
    // TODO: replace en_GB with express-locale middleware
    req.app.locals.s = strings.en;
    next();
});

// Send index page
app.get("/", function(req, res) {
    res.render("index.html");
});




var channels = [
    {
        name: "initial",
        namespace: "FezVrasta",
        users: []
    },
    {
        name: "bootstrap-material-design",
        namespace: "FezVrasta",
        users: []
    },
    {
        name: "ghat",
        namespace: "FezVrasta",
        users: []
    }
];

var github = {
    namespace: null,
    repository: null,
    issueURL: function() {
        return "https://github.com/" + this.namespace + "/" + this.repository + "/issues";
    },
    userURL: "https://github.com",
    commitURL: function() {
        return "https://github.com/" + this.namespace + "/" + this.repository + "/commit";
    },
    testCommitURL: function(hash, callback) {
        var url = github.commitURL() + "/" + hash;

        request({
            url: "https://api.github.com/repos/" + this.namespace + "/" + this.repository + "/commits/" + hash,
            headers: {
                "User-Agent": "Ghat - GitHub Chat"
            }
        }, function (error, response) {
            if (error || JSON.parse(response.body).message == "Not Found") {
                callback(hash);
            } else {
                callback("[" + hash + "](" + url + ")");
            }
        });
    }
};

io.on("connection", function(socket){

    socket.on("chat login", function(user) {
        socket.username = user.username;
    });

    socket.on("disconnect", function() {

        channels = _.map(channels, function(channel) {
            channel.users.splice(channel.users.indexOf(socket.username), 1);
            return channel;
        });
        io.emit("channels users", channels);
    });

    io.emit("channels users", channels);

    // Get messages
    socket.on("chat message", function(message){

        var text = message.text;
        async.waterfall([

            function(next) {
                // Strip HTML from text message
                next(null, strip(text));
            },
            function(text, next) {
                // Find issues references
                if (message.namespace) {
                    github.namespace = message.namespace;
                    github.repository = message.channel;
                    text = text.replace(/#(\d+)/g, "[#$1](" + github.issueURL() + "/$1)");
                }
                next(null, text);
            },
            function(text, next) {
                // Username rules:
                // 1. Alphanumerics and underscores only
                // 2. min 2 and max 15
                // 3. cannot start with underscore
                // 4. underscore cannot appear next to each other (__)

                // The current regex does not fullfill the point 4
                message.mentions = _.map(message.text.match(/@((?!_)[A-z0-9_]{2,15})/g), function(user) {
                    return user;
                });

                text = message.text.replace(/@((?!_)[A-z0-9_]{2,15})/g, "[@$1](" + github.userURL + "/$1)");
                next(null, text);
            },
            function(text, next) {

                // Detect only SHA1 long min 7 and max 40
                if (message.namespace) {
                    github.namespace = message.namespace;
                    github.repository = message.channel;

                    var matches = text.match(/\b([0-9a-f]{7,40})\b/g, github.testCommitURL);

                    if (matches.length) {
                        async.each(matches, function(sha, done) {

                            github.testCommitURL(sha, function(shatext) {
                                text = text.replace(sha, shatext);
                                done();
                            });

                        }, function() {
                            next(null, text);
                        });
                    } else {
                        next(null, text);
                    }

                } else {
                    next(null, text);
                }

            },
            function(text, next) {
                // Parse Markdown
                next(null, md(text));
            },
            function(text, next) {
                // Parse BBCODE
                next(null, bbcode(text));
            }


        ], function(err, text) {
            message.text = text;

            // Emit message
            io.emit("chat message", message);
        });


        // Find commit SHA1 IDs

    });

    socket.on("channels enter", function(action) {
        channels = _.map(channels, function(channel) {
            if (channel.name == action.channel && _.indexOf(channel.users, action.username) == -1) {
                channel.users.push(action.username);
            }
            return channel;
        });
        io.emit("channels users", channels);

        _.each(channels, function(channel) {
            if (channel.name == action.channel) {
                io.emit("users of channel", channel.users);
            }
        });

        io.emit("chat message", {
            channel: action.channel,
            username: "Room bot",
            text: md("**" + action.username + "** has joined the **" + action.channel + "** room.")
        });
    });

    socket.on("channels leave", function(action) {
        channels = _.map(channels, function(channel) {
            if (channel.name == action.channel) {
                channel.users.splice(channel.users.indexOf(action.username), 1);
                io.emit("users of channel", channel.users);
            }
            return channel;
        });
        io.emit("channels users", channels);
        io.emit("chat message", {
            channel: action.channel,
            username: "Room bot",
            text: md("**" + action.username + "** has left the **" + action.channel + "** room.")
        });
    });
});

app.get("/status/:channel/badge.png", function(req, res) {

    var users = 0;
    async.each(channels, function(channel, next) {

        if (channel.name == req.params.channel) {
            users = channel.users.length;
        }
        next();

    }, function() {
        var badge;
        if (users) {
            badge = "public/imgs/badge-online.png";
        } else {
            badge = "public/imgs/badge-offline.png";
        }
        res.sendfile(badge);
    });

});

http.listen(3001, function(){
    console.log("Chat started at localhost:3001");
});
