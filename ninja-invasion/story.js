// Created with Squiffy 5.1.2
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'begin';
squiffy.story.id = 'd78238025e';
squiffy.story.sections = {
	'begin': {
		'text': "<p>Ninja Invasion</p>\n<p>1415 A.C. You are a ninja warrior, member of the Gozoku Clan. You received a mission to infiltrate the shogun castle and end his reign. Rumors say they have been fooling with forbidden alchemy techniques.\nYou stand, hidden, near the castle&#39;s entrance. Two samurai block the path. There are also cherry trees and stones.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"soldier\" role=\"link\" tabindex=\"0\">Attack the soldier</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"grab throw\" role=\"link\" tabindex=\"0\">Grab a stone and throw</a></p>",
		'passages': {
		},
	},
	'soldier': {
		'text': "<p>The samurai unsheath their katana<br>\nYou kill one, but the other cuts you in half. You died.\n<a class=\"squiffy-link link-section\" data-section=\"begin\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'grab throw': {
		'text': "<p>The stone made a loud noise, calling the soldiers&#39;s attention. The path is clear.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"main hall\" role=\"link\" tabindex=\"0\">Enter the door</a></p>",
		'passages': {
		},
	},
	'main hall': {
		'text': "<p>{if seen orange potion:\nYou are back in the main hall. You sneak past the two confused guards, who are still looking for an intruder. Only the skull-marked door remains unchecked, but you could also exit through the main door and give up this foolish quest.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"skull door\" role=\"link\" tabindex=\"0\">Enter the skull-marked door</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"runaway ending\" role=\"link\" tabindex=\"0\">Run for your life</a>\n}\n{else:\nYou are in the castle main hall.<br>\nTo the left, you see a door marked with a potion symbol. To the right, another door is marked with a skull symbol. A samurai guards each entrance. There are also masks hanging at the wall, armory and a candle lighting the room.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"left door\" role=\"link\" tabindex=\"0\">Enter the left door (potion mark)</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"right door\" role=\"link\" tabindex=\"0\">Enter the right door (skull mark)</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"the candle\" role=\"link\" tabindex=\"0\">Blow out the candle</a>\n}</p>",
		'passages': {
		},
	},
	'left door': {
		'text': "<p>You were caught. You died.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"main hall\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'right door': {
		'text': "<p>You were caught. You died.<br></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"main hall\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'the candle': {
		'text': "<p>The room is dark. The guards can no longer see you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"potion door\" role=\"link\" tabindex=\"0\">Enter the left door (potion mark)</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"skull door\" role=\"link\" tabindex=\"0\">Enter the right door (skull mark)</a></p>",
		'passages': {
		},
	},
	'potion door': {
		'text': "<p>The room is empty. There are some marks on the floor. There is also a door leading to another room.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"trap\" role=\"link\" tabindex=\"0\">Enter the door</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"shuriken\" role=\"link\" tabindex=\"0\">Throw shuriken at the door</a></p>",
		'passages': {
		},
	},
	'trap': {
		'text': "<p>You fell into a trap. It appeared a hole beneath you. The ground is full of spikes. You died.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"potion door\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'shuriken': {
		'text': "<p>You activated a trap on the door. You now see the safe path.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"laboratory\" role=\"link\" tabindex=\"0\">Enter the laboratory</a></p>",
		'passages': {
		},
	},
	'laboratory': {
		'text': "<p>You see a laboratory. The room has a wardrobe, skeletons and a giant table full of test tubes. The light is dim.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"table\" role=\"link\" tabindex=\"0\">Examine the table</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"wardrobe\" role=\"link\" tabindex=\"0\">Examine the wardrobe</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"alchemist\" role=\"link\" tabindex=\"0\">Exit through the door you came from</a></p>",
		'passages': {
		},
	},
	'table': {
		'text': "<p>You see five different potions. Their colors are white, black, blue, green and orange.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"laboratory\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'wardrobe': {
		'text': "<p>You see a dead body covered in blood.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"laboratory\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'alchemist': {
		'text': "<p>You sense someone you hadn&#39;t noticed approaching. It is the chief alchemist.<br>\nAlchemist: &quot;Well, I suppose you were trying to sabotage the plans. The Shogun will not be pleased to know you were here. However, we can play a little game. I believe you have seen the five potions here. Only one will not kill you when you drink it. If you discover the right one, I can tell the secret of our secret weapon. If not, you die. You cannot leave. To help you, I can give you a hint: What does one see as the light of day meets the darkness of night?&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"ninjas\" role=\"link\" tabindex=\"0\">Run away</a> </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"wrong potion\" role=\"link\" tabindex=\"0\">Drink the white potion</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"wrong potion\" role=\"link\" tabindex=\"0\">Drink the black potion</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"wrong potion\" role=\"link\" tabindex=\"0\">Drink the blue potion</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"wrong potion\" role=\"link\" tabindex=\"0\">Drink the green potion</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"orange potion\" role=\"link\" tabindex=\"0\">Drink the orange potion</a></p>",
		'passages': {
		},
	},
	'ninjas': {
		'text': "<p>The alchemist summons the guards. You kill some of them, but they eventually overwhelm you. You died.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"alchemist\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'wrong potion': {
		'text': "<p>The potion is poisoned. You died.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"alchemist\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'orange potion': {
		'text': "<p>The potion has no effect on you.<br>\nAlchemist: &quot;That&#39;s right. The right answer is the sunset, which is orange. Well, I like you. I&#39;ve been kept as a prisoner here since 1390 A.C. Twenty-five years… We are seeking the Philosopher&#39;s Stone. That&#39;s right. We are in the middle of the tests. What you can find here is just the incomplete version, our researchers haven&#39;t finished yet. It grants incredible powers to whoever possesses it. But, in the current state, it will demand a high cost... You can&#39;t touch it with your own hands. Take these golden gauntlets and you will be able to handle it. And remember: it&#39;s fragile. Please don&#39;t break it, for my own sake. Farewell.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"main hall\" role=\"link\" tabindex=\"0\">Back to main hall</a></p>",
		'passages': {
		},
	},
	'skull door': {
		'text': "<p>The room is filled with weapons. There is a bookshelf. There are two candles, one lit and one unlit. It looks like a dead end.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"weapons\" role=\"link\" tabindex=\"0\">Examine the weapons</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bookshelf\" role=\"link\" tabindex=\"0\">Examine the bookshelf</a></p>\n<p>{if seen book:\n<a class=\"squiffy-link link-section\" data-section=\"grab lit candle\" role=\"link\" tabindex=\"0\">Grab the lit candle</a>\n}</p>",
		'passages': {
		},
	},
	'weapons': {
		'text': "<p>Looks like regular weapons.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"skull door\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'bookshelf': {
		'text': "<p>There are books about black magic. There is a suspicious purple book.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"book\" role=\"link\" tabindex=\"0\">Examine the book</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"skull door\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'book': {
		'text': "<p>The book has a marked page. It says: &quot;キャンドルを照らす。&quot;. You are thankful for knowing the language, since there is no way to search for something like this in your world.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"skull door\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'grab lit candle': {
		'text': "<p>You hold the lit candle in your hands.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"weapons\" role=\"link\" tabindex=\"0\">Examine the weapons</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bookshelf\" role=\"link\" tabindex=\"0\">Examine the bookshelf</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"light candle\" role=\"link\" tabindex=\"0\">Light the other candle</a></p>",
		'passages': {
		},
	},
	'light candle': {
		'text': "<p>The bookshelf moves and a narrow passageway stands before you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"throne room\" role=\"link\" tabindex=\"0\">Enter the passage</a></p>",
		'passages': {
		},
	},
	'throne room': {
		'text': "<p>You are in the throne room. To your left, {if seen orange potion:the philosopher&#39;s stone}{else: a crimson red} shines atop an altar. A large, menacing man sits at the throne, unaware of your presence. The shogun.</p>\n<p>{if seen orange potion:\n<a class=\"squiffy-link link-section\" data-section=\"grab philosopher stone\" role=\"link\" tabindex=\"0\">Grab the philosopher&#39;s stone</a></p>\n<p>{if seen golden gloves:}\n{else:\n<a class=\"squiffy-link link-passage\" data-passage=\"golden gloves\" role=\"link\" tabindex=\"0\">Wear the golden gloves</a>\n}\n}\n{else:\n<a class=\"squiffy-link link-section\" data-section=\"grab philosopher stone\" role=\"link\" tabindex=\"0\">Grab the red stone</a>\n}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"shuriken shogun\" role=\"link\" tabindex=\"0\">Throw shuriken at the shogun</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"strike shogun\" role=\"link\" tabindex=\"0\">Strike the shogun with your sword</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"runaway ending\" role=\"link\" tabindex=\"0\">Run for your life</a></p>",
		'passages': {
			'golden gloves': {
				'text': "<p>You put on the golden gloves. You may now safely handle the philosopher&#39;s stone.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"throne room\" role=\"link\" tabindex=\"0\">Back</a></p>",
			},
		},
	},
	'grab philosopher stone': {
		'text': "<p>{if seen golden gloves:\nThe philosopher&#39;s stone starts glowing as you feel a rush of power. The shogun notices and rushes toward you, sword in hand. You must decide what to do.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"strike shogun\" role=\"link\" tabindex=\"0\">Strike the shogun</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"crushed stone ending\" role=\"link\" tabindex=\"0\">Crush the stone</a>\n}\n{else:\nThe stone is poisoned. Your skin is turning dark. Your vision is fading. You died.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"throne room\" role=\"link\" tabindex=\"0\">Back</a>\n}</p>",
		'passages': {
		},
	},
	'shuriken shogun': {
		'text': "<p>Your shuriken hits the shogun right in the head. His limp body falls to the ground. Waves of guards come at you, but you manage to escape the castle.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"dead shogun ending\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'strike shogun': {
		'text': "<p>{if seen golden gloves:\n{if seen grab philosopher stone:\nThe shogun attacks you, but his movements are now incredibly slow. You parry his sword and counter attack with a clean slash at the throat. The shogun is dead.<br>\nThe guards rush at you, but you quickly dispatch them. You must now decide what to do with the philosopher&#39;s stone.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"destroyed stone ending\" role=\"link\" tabindex=\"0\">Destroy the stone</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"kept stone ending\" role=\"link\" tabindex=\"0\">Keep the stone</a>\n}\n{else:\nThe shogun notices your advance. He parries your sword and counter attacks, never even leaving the throne. You died.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"throne room\" role=\"link\" tabindex=\"0\">Back</a>\n}\n}\n{else:\nThe shogun notices your advance. He parries your sword and counter attacks, never even leaving the throne. You died.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"throne room\" role=\"link\" tabindex=\"0\">Back</a>\n}</p>",
		'passages': {
		},
	},
	'crushed stone ending': {
		'text': "<p>You crush the philosopher&#39;s stone, but the furious shogun delivers a killing stab to your heart. He keeps stabbing as you lose your strength and your body falls to the ground, in pieces. You have sacrificed yourself for the sake of the clan.</p>\n<p>Now back to traditional warfare, the battle between the clan and the shogun stretchs for countless generations, with both sides taking losses. The lone warrior who once sacrificed himself to prevent the shogun from rising to full power is remembered fondly.</p>\n<p>The clan and the shogun live. Yet, some wonder if it would not have been possible eliminate the shogun threat entirely, instead of only damaging it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'dead shogun ending': {
		'text': "<p>A few years pass. Your clan prospers for a time, but a new shogun eventually rises. Glowing with a bright red power, he decimates your people and kills you. </p>\n<p>Your clan is no more. The new shogun reigns.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'runaway ending': {
		'text': "<p>Cowering in fear, you run away. You survive the invasion, but the shogun lives.<br> Months later, he appears at your village and, glowing red with power, destroys your clan and kills you.</p>\n<p>Your clan is no more. The shogun reigns.   </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'destroyed stone ending': {
		'text': "<p>You smash the stone with your own hands. Its fragments enter your skin, killing you in a few moments. You sacrificed yourself for the sake of the clan.</p>\n<p>The shogunate has been extinguished and people are free once again. The clan remains their protector from the shadows, prospering alongside them. The efforts of the lone warrior taking on the full might of the shogun will be remembered for generations to come.</p>\n<p>You have fullfilled your destiny. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'kept stone ending': {
		'text': "<p>You keep the stone. The glow calls to you, its beauty mysteriously captivating. It brings out everything you had under restraint: your desires, your hunger for power, your... vision of a great nation. You no longer feel the need to pay respects to the clan. They do not see what you see.</p>\n<p>After taking control of the castle, you decide to establish a brand new seat of power. You clear the lands of your former clan in a massacre, personally delivering the killing blow to your old masters. </p>\n<p>Your clan is no more. You, the almighty shogun, reign.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'restart': {
		'text': "",
		'js': function() {
			squiffy.story.restart();
		},
		'passages': {
		},
	},
}
})();