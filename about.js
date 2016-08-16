/*
Copyright 2015, 2016 Sam Kauffman

Along with about.html, this file is licensed under a Creative Commons
Attribution-NonCommercial-NoDerivatives 4.0 International License.
*/

/* Load the example JSON into the textareas. */

var examples = [
    'California_Chrome',
    'American_Pharaoh',
    'Cleopatra',
    'Charles_II_5_gen',
    'Charles_II_9_gen',
    'Ex_1_Inbred_common_ancestor',
    'Ex_2_No_inbred_common_ancestors',
    'Ex_3_3_generations_of_sib_mating',
    'Ex_4_Hatshepsut',
    'Ex_5_Directly_related_parents',
    'Ex_6_Directly_and_collaterally_related_parents'
    ];

$(document).ready(function () {
    for (var i = 0; i < examples.length; i++) {
        $('textarea#' + examples[i]).load('Examples/' + examples[i] +'.json');
    }
});
