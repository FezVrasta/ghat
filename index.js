var express             = require("express"),
    app                 = express(),
    electricity         = require("electricity"),
    http                = require("http").Server(app),
    io                  = require("socket.io")(http),
    mustacheExpress     = require("mustache-express"),
    strip               = require("strip"),
    bbcode              = require("bbcode").parse,
    md                  = require("markdown").markdown.toHTML,
    _                   = require("lodash");

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
    userURL: "https://github.com/"
};

io.on("connection", function(socket){

    io.emit("channels users", channels);

    // Get messages
    socket.on("chat message", function(message){
        // Strip HTML from text message
        message.text = strip(message.text);

        // Find issues references
        message.text = (function() {
            if (message.namespace) {
                github.namespace = message.namespace;
                github.repository = message.channel;
                return message.text.replace(/#(\d+)/g, "[#$1](" + github.issueURL() + "/$1)");
            } else {
                return message.text;
            }
        }());

        // Find users references
        message.text = (function() {

            // Username rules:
            // 1. Alphanumerics and underscores only
            // 2. min 2 and max 15
            // 3. cannot start with underscore
            // 4. underscore cannot appear next to each other (__)

            // The current regex does not fullfill the point 4

            github.namespace = message.namespace;
            github.repository = message.channel;
            return message.text.replace(/@((?!_)[A-z0-9_]{2,15})/g, "[@$1](" + github.userURL + "/$1)");
        }());

        // Parse Markdown
        message.text = md(message.text);
        // Parse BBCODE
        message.text = bbcode(message.text);
        // Emit message
        io.emit("chat message", message);
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

http.listen(3000, function(){
    console.log("Chat started at localhost:3000");
});
