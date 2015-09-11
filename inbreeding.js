"use strict";

/*
inbreeding.js
by Sam Kauffman
*/

// maximum number of generations supported
var MAX_GENS = 12

// Used with the buttons. Value is null or a jQuery object.
var currentField = null;

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
            throw Exception('Node matching code ' + code + ' does not exist');
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
            throw Exception('Node matching name "' + name + '" does not exist');
        }
    }
    
    return node;
}

function updateField(code, name) {
    var field = $('input#' + (code || 'offspring')); // empty if generation is not visible
    field.val(name);
    field.data('oldName', name); // Store the new name
}


/*****************************
Functions that manipulate the UI
*****************************/

function clearResult() {
    $('#result, #breakdown').html('');
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

function showHideGenerations(numGens) {
    var curGens = parseInt($('input.ind').last().closest('table').data('level'));
    var gen;
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
}

// Allows us to treat showHideGenerations as a normal function
// instead of a jQuery event handler
function showHideGenerationsHandler() {
    showHideGenerations();
}

function showMore() {
    showHideGenerations(parseInt($(this).closest('table').data('level')) + 1);
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

function showNameChoices() {
    var text = $(this).val();
    var node;
    var nameChoices = [];
    var i;
    
    if (text.length === 0) {
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

function setFieldFromMenu () {
    /* Populate the field (node) and its ancestors identically to the selected
    name. If the name occurs more than once, prefer an occurrence that has
    the most parents. */
    var newName = $(this).text();
    var field = $(this).parent().siblings('input.ind');
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
    
    // Remove the menu
    $(this).parent().remove();
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
    var oldName = $(this).data('oldName');
    var new_name = $(this).val();
    var code = getCode($(this));
    if (oldName) {
        // Remove data from ancestors and names
        clearName(oldName, code);
    }
    if (new_name) {
        // Add or overwrite data in pedigree
        // Add data to generations if necessary
        // Add data to ancestors and names
        addInd(code, new_name);
    } else {
        // Remove data from pedigree and generations
        removeInd(code);
    }
    $(this).data('oldName', new_name); // Store the new name
}


/*****************************
Buttons
*****************************/

function calculate() {
    var ancs;
    var common = []; // common ancestors
    var name;
    var code1;
    var code2;
    var i;
    var interm = {}; // intermediate ancestor names (object used like a set)
    var path;
        
    $(currentField).blur();
    
    // Deep copy of ancestors because we will iterate over it desctructively
    ancs = $.extend(true, {}, ancestors);
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
                        interm[getNodeFromCode(code1.slice(0, i)).name] = null;
                    }
                    // Walk through the intermediate ancestors of the second code
                    // and make sure none are in the first code.
                    for (i = 1; i < code2.length; i += 1) {
                        if (getNodeFromCode(code2.slice(0, i)).name in interm) {
                            // Found a intermediate ancestor that is in both codes.
                            // This is not an inbreeding path.
                            path = false;
                            break;
                        }
                    }
                    if (path) {
                        console.log(name, code1, code2);
                        common.push({
                            name: name,
                            // 2^(-(length1 + length2 - 1)) using shift operator
                            inbreeding: 1.0 / (1 << (code1.length + code2.length - 1))
                            });
                    }
                }
            }
            // Iterate destructively to avoid processing the same pairs again
            delete ancs[name][code1];
        }
    }
    common.sort(function (a, b) { return a.inbreeding < b.inbreeding; });

    $('#result').text((common.map(function(anc) {
        return anc.inbreeding;
        }).reduce(function(a, b) {
            return a + b;
            }, 0.0)
            * 100.0).toFixed(2) + '%');
    $('#breakdown').html(common.map(function(anc) {
        return '<li><b>' + (anc.inbreeding * 100).toFixed(2) + '%</b> through ' + anc.name + '</li>';
        }));
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
    try {
        node = getNodeFromCode(code);
    } catch(e) {
        return;
    }

    clear(node, code); // Recursive
    
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

function clearAll() {
    clearField($('input#offspring'));
}
function clearSelected() {
    $(currentField).change();
    clearField(currentField);
}
function showOffspringData() {
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
    $('#generations').change(showHideGenerationsHandler);
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
    // Elements in #pedigree are built dynamically so delegate handlers.
    $('#pedigree')
        .on('change keydown', 'input.ind', clearResult)
        .on('focusin', 'input.ind', setCurrentField)
        .on('focusout', 'input.ind', clearCurrentField)
        .on('click', '.more', showMore)
        .on('change', 'input.ind', changeField)
        .on('keyup', 'input.ind', showNameChoices)
        .on('click', 'ul.name-choices li', setFieldFromMenu)
        .on('blur', 'input.ind', hideNameChoices);
    
    clearCurrentField();
    });