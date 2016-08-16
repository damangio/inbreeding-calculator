"use strict";

/*
Copyright 2015, 2016 Sam Kauffman

This file is part of the Inbreeding Calculator.

The Inbreeding Calculator is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

// maximum number of generations supported
var MAX_GENS = 12

// Used with the buttons. Value is null or a jQuery object.
var currentField = null;
// Field to focus after changing number of generations. Value is null or a jQuery object.
var generationsField = null;

/* The four important data structures */
/* pedigree stores the pedigree of the base individual in a tree structure,
including names. */
var pedigree = {};
/* Keys are names, values are sets of individual codes. And by "sets" I mean
objects in which all values are null. */
var ancestors = {};
/* Stores the list of names in a tree format, where each key is a single
letter. The key 'end' means the end of the name. */
var names = {};
/* Keys are generation numbers. Values are objects: keys are individual codes
 and values are objects from pedigree. */
var generations = {};
// initial population of generations
for (var i = 0; i <= MAX_GENS; i += 1) {
    generations[i] = {};
}
generations[0][''] = pedigree;
/* Cache the inbreeding coefficients of ancestors */
var ancestorCache;

/*****************************
Utility functions
*****************************/

function getCode(field) {
    if (field === null) {
        return undefined;
    }
    var code = field.attr('id');
    if (code === 'offspring') {
        code = '';
    }
    return code;
}
function getNodeFromCode(code) {
    var node = pedigree;
    for (i = 0; i < code.length; i += 1) {
        if (code[i] in node) {
            node = node[code[i]];
        } else {
            throw 'Node matching code ' + code + ' does not exist';
        }
    }
    return node;
}
function getNodeFromName(name) {
    var node = names;
    for (i = 0; i < name.length; i += 1) {
        if (name[i] in node) {
            node = node[name[i]];
        } else {
            throw 'Node matching name "' + name + '" does not exist';
        }
    }
    
    return node;
}

Number.prototype.toFixedOrPrecision = function (digits) {
    /* Format the floating-point number with n decimal places if it is
    at least 1. Otherwise format to n digits of precision. This way it
    always has at least n decimal places and at least n digits of
    precision. */
    if (this >= 1.0) {
        return this.toFixed(digits);
    } else {
        return this.toPrecision(digits);
    }
}


/*****************************
Functions that manipulate the UI
*****************************/

function wideFields() {
    // toggle wide fields
    if ($(this).prop('checked')) {
        $('head').append(
            '<style id="wide_style">input.ind{ width: 15em; }</style>');
    } else {
        $('#wide_style').remove();
    }
}

function highlightField(field) {
    // Highlight a field in yellow and then fade back to white
    var l = 50;
    var fade;
    field.css({'background-color': 'hsl(60, 100%, 50%)'});
    fade = window.setInterval(function () {
        l += 10;
        field.css({'background-color': 'hsl(60, 100%, ' + l + '%)'});
        if (l >= 100) {
            clearInterval(fade);
        }
        }, 100);
}

function updateField(code, name) {
    var field = $('input#' + (code || 'offspring')); // empty if generation is not visible
    field.val(name);
    field.data('oldName', name); // Store the new name
    highlightField(field);
}

function clearResult() {
    $('#result, #breakdown').html('');
    // Set the controls area back to its normal width
    $('body').removeClass('results');

}

// Use a 1/10-second delay for these because the buttons need to grab
// the current field before it stops being current as a result of losing focus.
function setCurrentField() {
    var field = $(this);
    window.setTimeout(function () {
        currentField = field;
        $('button.require-selection').prop('disabled', false);
    }, 100);
}
function clearCurrentField() {
    window.setTimeout(function () {
        currentField = null;
        $('button.require-selection').prop('disabled', true);
    }, 100);
}

function updateMoreLabels(curGens) {
    var code;
    /* Indicate whether individuals in the rightmost generation have
    ancestor data. */
    if (curGens === undefined) {
        curGens = parseInt($('input.ind').last().closest('table').data('level'));
    }
    if (curGens === MAX_GENS) {
        return;
    }
    
    // Remove existing labels.
    $('.more').remove();
    
    for (code in generations[curGens]) {
        if ('s' in generations[curGens][code] ||
            'd' in generations[curGens][code]) {
                $('input#'  + code).parent().siblings('.anc').html(
                    '<span class="more"><b>&rarr;</b> More&nbsp;</span>');
        }
    }
}

function focusGenerations() {
    generationsField = currentField;
}

function unfocusGenerations() {
    generationsField = null;
}

function showHideGenerations(numGens, focusField) {
    var curGens = parseInt($('input.ind').last().closest('table').data('level'));
    var gen;
    var testField;
    if (numGens === undefined) {
        numGens = parseInt($('#generations').val());
    }
    
    $('#generations').val(numGens);
    
    if (numGens < curGens) {
        // Show fewer generations
        $('#pedigree table').each(function () {
            if (parseInt($(this).data('level')) > numGens) {
                $(this).remove();
            }
        });
    }
    
    else if (numGens > curGens) {
        // Show more generations
        // Add new tables at each new level
        for (gen = curGens + 1; gen <= numGens; gen += 1) {
            $('#pedigree table[data-level=' + (gen - 1) + '] td.anc').each(function () {
                var code = getCode($(this).siblings().find('input.ind'));
                $(this).html(
                '<table data-level="' + gen +'">\n' +
                    '<tr class="s">\n' +
                        '<td>\n' +
                            '<input type="text" class="ind" id="' + code + 's">\n' +
                        '</td>\n' +
                        '<td class="anc"></td>\n' +
                    '</tr>\n' +
                    '<tr class="d">\n' +
                        '<td>\n' +
                            '<input type="text" class="ind" id="' + code + 'd">\n' +
                        '</td>\n' +
                        '<td class="anc"></td>\n' +
                    '</tr>\n' +
                '</table>\n');
                
                // Populate new fields with existing ancestor data
                if ((code + 's') in generations[gen] && generations[gen][code + 's'].name) {
                    $('input#' + code + 's').val(generations[gen][code + 's'].name);
                }
                if ((code + 'd') in generations[gen] && generations[gen][code + 'd'].name) {
                    $('input#' + code + 'd').val(generations[gen][code + 'd'].name);
                }
            });
        }
    }
    
    updateMoreLabels(numGens);
    
    // Focus the field the user last worked with.
    if (focusField !== undefined) {
        focusField.focus();
        // If a field was passed, that means "More" was clicked, so scroll to the right.
        $('#pedigree').scrollLeft($('#pedigree').width());
    } else if (generationsField) {
        if (document.contains(generationsField[0])) {
        // Field hasn't been removed
            generationsField.focus();
        } else {
            // Field has been removed. Walk down the pedigree looking for
            // a field that exists.
            for (gen = generationsField.attr('id').length - 1; gen >= 0; gen -= 1) {
                testField = $('#' + generationsField.attr('id').slice(0, gen));
                if (testField.length) {
                    // field exists
                    testField.focus();
                    break;
                }
            }
        }
    } else {
        $('#offspring').focus();
    }
}

// Allows us to treat showHideGenerations as a normal function
// instead of a jQuery event handler
function showHideGenerationsHandler() {
    showHideGenerations();
}

function showMore() {
    showHideGenerations(parseInt($(this).closest('table').data('level')) + 1,
        $(this).parent().prev().find('input.ind'));
}

// The recursive part of showNameChoices
function buildNameChoices(node, text, nameChoices) {
    var letter;
    for (letter in node) {
        if (letter === 'end') {
            nameChoices.push(text);
        } else {
            buildNameChoices(node[letter], text + letter, nameChoices);
        }
    }
}

function showNameChoices(event) {
    var text = $(this).val();
    var node;
    var nameChoices = [];
    var i;
    
    if (text.length === 0 || event.keyCode === 13) { // Ignore when the Enter key is pressed
        return;
    }
    
    try {
        node = getNodeFromName(text);
    } catch (e) {
        // No names match
        $(this).siblings('ul.name-choices').remove();
        return;
    }
    buildNameChoices(node, text, nameChoices);

    if (nameChoices) {
        nameChoices.sort();
        nameChoices = nameChoices.map(function(nameChoice) {
            return ('<li>' + nameChoice + '</li>');
            });
        $(this).siblings('ul.name-choices').remove();
        $(this).after('<ul class="name-choices">\n' +
            nameChoices.join('\n') + '</ul>\n');
    }
}

function hideNameChoices() {
    if ($('ul.name-choices li:hover').length === 0) {
        // User is not on the name chioce list
        $('ul.name-choices').remove();
    }
}

function setFieldFromMenu() {
    var newName = $(this).text();
    var field = $(this).parent().siblings('input.ind');
    
    populateFieldFromName(field, newName)
    
    // Remove the menu
    $(this).parent().remove();
}
    
function populateFieldFromName(field, newName) {
    /* Populate the field (node) and its ancestors identically to the given
    name. If the name occurs more than once, prefer an occurrence that has
    the most parents. */
    var code; // Code of the ancestor we want to copy
    var node; // The node we want to copy
    var data; // Copy of that node's data
    var tmpNode;
    var numParents;
    var maxNumParents = -1;
    
    if (!(newName in ancestors)) {
        return;
    }
    
    for (code in ancestors[newName]) {
        numParents = 0;
        tmpNode = getNodeFromCode(code);
        if ('s' in tmpNode) {
            numParents += 1;
        }
        if ('d' in tmpNode) {
            numParents += 1;
        }
        if (numParents > maxNumParents) {
            maxNumParents = numParents;
            node = tmpNode;
        }
        if (numParents === 2) {
            // Can't get higher than this
            break;
        }
    }
        
    // Deep copy, to avoid overwriting the data we want to copy
    data = $.extend(true, {}, node);
    
    populateField(field, data);

    replicate(getCode(field));
}

function replicate(code) {
    /* If this individual's offspring occurs anywhere else, populate
    the other occurrence's parent with this individual's data. */
    var cleared = false;
    var parentType; // 's' or 'd'
    var node;
    var offspringCode;
    var offspringNode;
    var otherOffspringCode;
    var otherOffspringNode;
    if (code.length < 2) {
        return;
    }
    parentType = code.slice(-1);
    
    try {
        node = getNodeFromCode(code);
    } catch (e) {
        // We deleted the name.
        cleared = true;
    }
    offspringCode = code.slice(0, -1)
    try {
        offspringNode = getNodeFromCode(offspringCode);
    } catch (e) {
        // This individual's offspring was blank. Do nothing.
        return;
    }

    for (otherOffspringCode in ancestors[offspringNode.name]) {
        if (otherOffspringCode !== offspringCode) {
            if (otherOffspringCode.length >= MAX_GENS) {
                break;
            }
            otherOffspringNode = getNodeFromCode(otherOffspringCode);
            if (cleared) {
                clear(
                    otherOffspringNode[parentType],
                    otherOffspringCode + parentType);
            } else {
                if (!(parentType in otherOffspringNode)) {
                    otherOffspringNode[parentType] = {};
                    generations[otherOffspringCode.length + 1][otherOffspringCode + parentType]
                        = otherOffspringNode[parentType];
                }
                populate(
                    otherOffspringNode[parentType],
                    otherOffspringCode + parentType,
                    node);
            }
        }
    }
    updateMoreLabels();
}

function replicateField() {
    replicate(getCode($(this)));
}

function toggleBreakdown() {
    $(this).toggleClass('open').toggleClass('closed');
}


/*****************************
Functions that manipulate data
*****************************/

function addInd(code, name) {
    var node = pedigree;
    var is_new_name = false;
    var i;
    
    if (code.length > MAX_GENS) {
        return;
    }
    
    // Add individual to pedigree
    for (i = 0; i < code.length; i += 1) {
        if (!(code[i] in node)) {
            node[code[i]] = {};
            // Add individual (intermediate or final) to generations
            generations[i + 1][code.slice(0, i + 1)] = node[code[i]];
        }
        node = node[code[i]];
    }
    node.name = name;
    
    // Add name to ancestors
    if (!(name in ancestors)) {
        ancestors[name] = {};
        is_new_name = true;
    }
    ancestors[name][code] = null; // Use an object as a set

    if (is_new_name) {
        // Add name to names
        node = names;
        for (i = 0; i < name.length; i += 1) {
            if (!(name[i] in node)) {
                node[name[i]] = {};
            }
            node = node[name[i]];
        }
        node.end = null; // End of name
    }
}

function removeInd(code) {
    var node = pedigree;
    var nodeList = [pedigree];
    var i;
    for (i = 0; i < code.length; i += 1) {
        if (code[i] in node) {
            node = node[code[i]];
            nodeList.push(node);
        } else {
            // it's not there. Do nothing. (This can happen with the Clear button.)
            return;
        }
    }
    delete node.name;
    // Now backtrack and delete nodes that have no name or ancestors.
    for (i = code.length - 1; i >= 0; i -= 1) {
        if ($.isEmptyObject(nodeList[i + 1])) {
            // deleted from pedigree
            delete nodeList[i][code[i]];
            // delete from generations
            delete generations[i + 1][code.slice(0, i + 1)];
        } else {
            // Stop deleting stuff
            break;
        }
    }
}

function clearName(name, code) {
    var node = names;
    var nodeList = [names];
    var other_occurrences = true;
    var i;
    
    // Delete this occurrence of the name from ancestors.
    delete ancestors[name][code];
    if ($.isEmptyObject(ancestors[name])) {
        // There are no other occurrences of the name, so delete the name.
        delete ancestors[name];
        other_occurrences = false;
    }
    
    if (!other_occurrences) {
        // Delete it from names.
        for (i = 0; i < name.length; i += 1) {
            if (name[i] in node) {
                node = node[name[i]];
                nodeList.push(node);
            } else {
                // Somehow it's not there. Do nothing.
                return;
            }
        }
        delete node.end; // Remove the word terminus
        // Now backtrack and remove everything that's orphaned
        for (i = name.length - 1; i >= 0; i -= 1) {
            if ($.isEmptyObject(nodeList[i + 1])) {
                // This branch is orphaned. Delete it from its parent.
                delete nodeList[i][name[i]];
            } else {
                // It is not orphaned. Stop deleting stuff.
                break;
            }
        }
    }
}

function changeField() {
    var field = $(this);
    var oldName = $(this).data('oldName');
    var newName = $(this).val();
    var code = getCode($(this));
    if (oldName) {
        // Remove data from ancestors and names
        clearName(oldName, code);
    }
    if (newName) {
        // Add or overwrite data in pedigree
        // Add data to generations if necessary
        // Add data to ancestors and names
        addInd(code, newName);
    } else {
        // Remove data from pedigree and generations
        removeInd(code);
    }
    $(this).data('oldName', newName); // Store the new name
    
    // Populate field if name already exists
    populateFieldFromName(field, newName);
}


/*****************************
Buttons
*****************************/

// verify() was made unnecessary by the addition of auto-replication
// It is not used.
function verify() {
    // Make sure there are no glaring errors in the data
    var node;
    var sireName;
    var damName;
    var code;
    for (name in ancestors) {
        sireName = damName = null;
        for (code in ancestors[name]) {
            node = getNodeFromCode(code);
            if ('s' in node) {
                if (sireName && sireName !== node.s.name) {
                    alert('Error: Individual ' + name + ' is listed with two different sires: ' +
                        sireName + ' and ' + node.s.name + '.');
                    return false;
                }
                sireName = node.s.name;
            }
            if ('d' in node) {
                if (damName && damName !== node.d.name) {
                    alert('Error: Individual ' + name + ' is listed with two different dams: ' +
                        damName + ' and ' + node.d.name + '.');
                    return false;
                }
                damName = node.d.name;
            }
        }
    }
    return true;
}

function calculateForName(name) {
    // Given the name of a common ancestor, calculate the inbreeding coefficient for it.
    var code;
    var node;
    var results = [];
    for (code in ancestors[name]) {
        node = getNodeFromCode(code);
        if ('s' in node && 'd' in node) {
            // Calculate for all ocurrences that have both parents
            results.push(calculateForCode(code));
        }
    }
    // Choose the highest value
    if (results.length > 0) {
        return Math.max.apply(null, results);
    }
    // no inbreeding paths
    return 0.0
}

function calculateForCode(baseCode, list) {
    /* Given the code of a specific node, calculate the inbreeding coefficient for it.
    If 'list' is true, return an array of objects with name and inbreeding coefficient
    for each common ancestor.
    Otherwise, return the total inbreeding coefficient. */
    var common = []; // list of common ancestors, or just their inbreeding coefficients
    var ancs; // copy of ancestors
    var name;
    var code;
    var code1;
    var code2;
    var i;
    var interm = {}; // intermediate ancestor names (object used like a set)
    var path;
    var inbreeding;
    var anc_inbreeding;

    // Deep copy of ancestors because we might modify it and we will iterate
    // over it destructively
    ancs = $.extend(true, {}, ancestors);

    if (baseCode.length > 0) {
        // This is a common ancestor of the offspring. Trim ancs and adjust codes
        for (name in ancs) {
            for (code in ancs[name]) {
                if (code.indexOf(baseCode) === 0) {
                    // This is an ancestor of our node (or it is our node).
                    // Trim our code off the front of the other code
                    ancs[name][code.slice(baseCode.length)] = null;
                }
                delete ancs[name][code];
            }
            if ($.isEmptyObject(ancs[name])) {
                // We deleted all codes for this name
                delete ancs[name];
            }
        }
    }

    // Iterate over ancs desctructively
    // This is the most efficient way to iterate over all pairs of attributes
    for (name in ancs) {
        for (code1 in ancs[name]) {
            for (code2 in ancs[name]) {
                if (code2 !== code1) {
                    /* Two different codes leading to the same ancestor create
                    a possible inbreeding path. If none of the intermediate ancestors
                    are the same, it is an inbreeding path. */
                    path = true;
                    interm = {};
                    // Make sure there are no intermediate ancestors common to the two paths
                    // Build the set of intermediate ancestors from the first code
                    for (i = 1; i < code1.length; i += 1) {
                        interm[getNodeFromCode(baseCode + code1.slice(0, i)).name] = null;
                    }
                    // Walk through the intermediate ancestors of the second code
                    // and make sure none are in the first code.
                    for (i = 1; i < code2.length; i += 1) {
                        if (getNodeFromCode(baseCode + code2.slice(0, i)).name in interm) {
                            // Found a intermediate ancestor that is in both codes.
                            // This is not an inbreeding path.
                            path = false;
                            break;
                        }
                    }
                    if (path) {
                        if (name in ancestorCache) {
                            anc_inbreeding = ancestorCache[name];
                        } else {
                            anc_inbreeding = calculateForName(name);
                            ancestorCache[name] = anc_inbreeding;
                        }
                        // 2^(-(length1 + length2 - 1))*(1 - FA) using shift operator
                        inbreeding = 1.0 /
                            (1 << (code1.length + code2.length - 1)) * (1.0 + anc_inbreeding);
                        if (list) {
                            common.push({
                                name: name,
                                inbreeding: inbreeding
                                });
                        } else {
                            common.push(inbreeding);
                        }
                    }
                }
            }
            // Iterate destructively to avoid processing the same pairs again
            delete ancs[name][code1];
        }
    }
    if (list) {
        return common;
    } else {
        return common.reduce(function(a, b) {
            return a + b;
            }, 0.0);
    }
}   

function calculate() {
    // User clicked the Calculate button
    $('#result').text('Calculating...');
    // Use setTimeout so we see the DOM change immediately.
    window.setTimeout(doCalculation, 0);
}
    
function doCalculation() {
    var common; // list of common ancestors
    var common2 = []; // consolidated list of common ancestors
    var anc;
    var anc_breakdown;
    var i;
    
    $(currentField).blur();
    ancestorCache = {}; // clear cache
    
    // Recursive
    // Result is a list of objects with properties 'name' and 'inbreeding', each
    // representing one inbreeding path.
    common = calculateForCode('', true);
    // Sort by name, then by inbreeding coefficient
    common.sort(function (a, b) {
        if (a.name === b.name) {
            return a.inbreeding < b.inbreeding ? 1 : -1;
        }
        return a.name < b.name ? -1 : 1;
        });

    // Consolidate the results to a list with one object per common ancestor
    for (i = 0; i < common.length; i += 1) {
        if (i > 0 && common[i - 1].name === common[i].name) {
            anc = common2[common2.length - 1]; // for convenience
            // increment ancestor
            anc.num_paths += 1;
            if (common[i - 1].inbreeding === common[i].inbreeding) {
                // increment path value
                anc.path_values[anc.path_values.length - 1].num_paths += 1;
            } else {
                // add new path value to ancestor
                anc.path_values.push({
                    inbreeding: common[i].inbreeding,
                    num_paths: 1
                    });
            }
        } else {
            // add new ancestor
            common2.push({
                name: common[i].name,
                num_paths: 1,
                path_values: [{
                    inbreeding: common[i].inbreeding,
                    num_paths: 1
                    }]
                });
        }
    }
    // Calculate total inbreeding coefficient for each common ancestor
    for (i = 0; i < common2.length; i += 1) {
        common2[i].inbreeding = common2[i].path_values.reduce(function(a, b) {
            return a + b.inbreeding * b.num_paths
            }, 0.0);
    }
    // Sort by total inbreeding coefficient, then by name
    common2.sort(function (a, b) {
        if (a.inbreeding === b.inbreeding) {
            return a.name < b.name ? -1 : 1;
        }
        return a.inbreeding < b.inbreeding ? 1 : -1;
        });
    
    // Display result and breakdown
    $('#result').html('<i>F</i> = ' + (
        common2.reduce(function(a, b) {
            return a + b.inbreeding;
            }, 0.0
        ) * 100.0).toFixedOrPrecision(2) + '%');
    $('#breakdown').html(common2.map(function(anc) {
        if (anc.num_paths > 1) {
            anc_breakdown = anc.path_values.map(function(path_value) {
                return '<li>' + (path_value.inbreeding * 100.0).toFixedOrPrecision(2) +
                    '% &times; ' + path_value.num_paths + '</li>';
                }).join('\n');
        } else {
            anc_breakdown = '';
        }
        return (anc.num_paths > 1 ? '<li class="closed">' : '<li>') +
            '<b class="coefficient">' + (anc.inbreeding * 100.0).toFixedOrPrecision(2) +
            '%</b> <span class="through">through</span> <b>' + anc.name + '</b> (' +
            anc.num_paths + '&nbsp;path' + (anc.num_paths > 1 ? 's' : '') + ')' +
            '<ul>' + anc_breakdown + '</ul></li>';
        }).join('\n'));
        
        // Widen the results area
        $('body').addClass('results');
}

function clear(node, code) {
    // The recursive part of clearField
    var oldName;
    if ('s' in node) {
        clear(node.s, code + 's');
    }
    if ('d' in node) {
        clear(node.d, code + 'd');
    }
    
    oldName = node.name;
    if (oldName) {
        clearName(oldName, code);
    }
    removeInd(code);
    updateField(code, '');
}

function clearField (field) {
    var code = getCode(field);
    var node;
    var fieldsToClear;
    try {
        node = getNodeFromCode(code);
    } catch(e) {
        return;
    }

    clear(node, code); // Recursive

    // The browser might have filled in fields that don't correspond to any pedigree
    // data, so clear fields now.
    if (code) {
        fieldsToClear = $('input[id^=' + code + ']')
    } else {
        // starting with offspring; clear all the fields
        fieldsToClear = $('#pedigree input');
    }
    fieldsToClear.each(function(i, elem) {
        $(elem).val('');
    });
    
    replicate(code);
    updateMoreLabels();
}

function showData(field) {
    var code = getCode(field);
    var node;
    try {
        node = getNodeFromCode(code);
    } catch (e) {
        // No data here
        return;
    }
    $('#textarea').val(JSON.stringify(node, null, 2));
}

function populate(node, code, data) {
    // Recursive part of populateField
    var oldName;
    if ('s' in data && code.length < MAX_GENS) {
        if (!('s' in node)) {
            node.s = {};
            generations[code.length + 1][code + 's'] = node.s;
        }
        populate(node.s, code + 's', data.s);
    } else if ('s' in node) {
        clear(node.s, code + 's');
    }
    if ('d' in data && code.length < MAX_GENS) {
        if (!('d' in node)) {
            node.d = {};
            generations[code.length + 1][code + 'd'] = node.d;
        }
        populate(node.d, code + 'd', data.d);
    } else if ('d' in node) {
        clear(node.d, code + 'd');
    }
    
    oldName = node.name;
    if (oldName) {
        clearName(oldName, code);
    }

    if (data.name) {
        addInd(code, data.name);
    } else {
        removeInd(code);
    }
    
    updateField(code, data.name);
}

function populateField(field, data) {
    var code = getCode(field);
    var node;
    var i;
    try {
        node = getNodeFromCode(code);
    } catch(e) {
        // Starting node doesn't exist yet
        // Build nodes to reach it
        node = pedigree;
        for (i = 0; i < code.length; i += 1) {
            if (!(code[i] in node)) {
                node[code[i]] = {};
                generations[i + 1][code.slice(0, i + 1)] = node[code[i]];
            }
            node = node[code[i]];
        }
    }

    populate(node, code, data); // Recursive
    
    updateMoreLabels();
}

function populateFieldFromPaste(field) {
    var text = $('#textarea').val();
    var data;
    if (text.length === 0) {
        alert('Text area is empty.');
        return;
    }
    try {
        data = JSON.parse(text);
    } catch(e) {
        if (e instanceof SyntaxError) {
            alert('Text could not be parsed.');
        } else {
            throw e;
        }
    }
    
    populateField(field, data);
}

// confirmation dialog
function confirm(message, noButton, yesButton, func) {
    $('body').append(
        '<div id="confirmDialog">' +
        '<p>' + message + '</p>' +
        '<p><button id="confirmNo">' + noButton + '</button>&nbsp;&nbsp;' +
            '<button id="confirmYes">' + yesButton + '</button></p>' +
        '</div>');
    $('#confirmNo').click(function () {
        $('#confirmDialog').remove();
    });
    $('#confirmYes').click(function () {
        $('#confirmDialog').remove();
        func();
    });
    $('#confirmDialog').css({
        left: ($(window).width()/2 - 150) + 'px',
        top: ($(window).height()/2 -100) + 'px',
    })
}

function clearAll() {
    confirm('Clear entire pedigree?', 'Cancel', 'Clear', function () {
        clearField($('input#offspring'));
    });
}
function clearSelected() {
    var field = currentField;
    confirm('Clear data?', 'Cancel', 'Clear', function () {
        $(field).change();
        clearField(field);
    });
}
function showOffspringData() {
    $(currentField).change();
    showData($('input#offspring'));
}
function showSelectedData() {
    $(currentField).change();
    showData(currentField);
}
function populateAll() {
    populateFieldFromPaste($('input#offspring'));
}
function populateSelected() {
    populateFieldFromPaste(currentField);
}


/*****************************
Initialization
*****************************/

$(document).ready(function() {
    $('#generations').change(showHideGenerationsHandler)
        .focus(focusGenerations)
        .blur(unfocusGenerations)
        .change(unfocusGenerations);
    $('#wide_fields').change(wideFields);
    // Buttons. Use mousedown instead of click because the focused field is losing focus.
    $('#calculate').mousedown(calculate);
    $('#clear, #clear-selected, #populate, #populate-selected')
        .mousedown(clearResult);
    $('#clear').mousedown(clearAll);
    $('#clear-selected').mousedown(clearSelected);
    $('#show-data').mousedown(showOffspringData);
    $('#show-selected-data').mousedown(showSelectedData);
    $('#populate').mousedown(populateAll);
    $('#populate-selected').mousedown(populateSelected);
    // Elements in #breakdown and #pedigree are built dynamically so delegate handlers.
    $('#breakdown')
        .on('click', '.open, .closed', toggleBreakdown)
    $('#pedigree')
        .on('change keydown', 'input.ind', clearResult)
        .on('focusin', 'input.ind', setCurrentField)
        .on('focusout', 'input.ind', clearCurrentField)
        .on('click', '.more', showMore)
        .on('change', 'input.ind', changeField)
        .on('change', 'input.ind', replicateField)
        .on('keyup', 'input.ind', showNameChoices)
        .on('click', 'ul.name-choices li', setFieldFromMenu)
        .on('blur', 'input.ind', hideNameChoices);
    
    clearCurrentField();
    });
