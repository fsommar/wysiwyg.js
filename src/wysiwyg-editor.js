(function(factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], function($){
            return factory(window, document, $);
        });
    } else if (typeof exports !== 'undefined') {
        module.exports = factory(window, document, require('jquery'));
    } else {
        return factory(window, document, jQuery);
    }
})(function(window, document, $){
    'use strict';

    // http://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
    var HSVtoRGB = function( h, s, v )
    {
        var r, g, b, i, f, p, q, t;
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6)
        {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        var hr = Math.floor(r * 255).toString(16);
        var hg = Math.floor(g * 255).toString(16);
        var hb = Math.floor(b * 255).toString(16);
        return '#' + (hr.length < 2 ? '0' : '') + hr +
                     (hg.length < 2 ? '0' : '') + hg +
                     (hb.length < 2 ? '0' : '') + hb;
    };

    // Encode htmlentities() - http://stackoverflow.com/questions/5499078/fastest-method-to-escape-html-tags-as-html-entities
    var html_encode = function( string )
    {
        return string.replace(/[&<>"]/g, function(tag)
        {
            var charsToReplace = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;'
            };
            return charsToReplace[tag] || tag;
        });
    };

    // Create the Editor
    var create_editor = function( $textarea, classes, placeholder, toolbar_position, toolbar_buttons, toolbar_submit, label_selectImage,
                                  placeholder_url, placeholder_embed, max_imagesize, on_imageupload, force_imageupload, video_from_url,
                                  on_keydown, on_keypress, on_keyup, on_autocomplete, disabled_button_title, on_disabled_button_click )
    {
        // Content: Insert link
        var wysiwygeditor_insertLink = function( wysiwygeditor, url )
        {
            if( ! url )
                ;
            else if( wysiwygeditor.getSelectedHTML() )
                wysiwygeditor.insertLink( url );
            else
                wysiwygeditor.insertHTML( '<a href="' + html_encode(url) + '">' + html_encode(url) + '</a>' );
            wysiwygeditor.closePopup().collapseSelection();
        };
        var content_insertlink = function(wysiwygeditor, $modify_link)
        {
            var $button = toolbar_button( toolbar_submit );
            var $inputurl = $('<input type="text" value="' + ($modify_link ? $modify_link.attr('href') : '') + '" />').addClass('wysiwyg-input')
                                .keypress(function(event){
                                    if( event.which != 10 && event.which != 13 )
                                        return ;
                                    if( $modify_link )
                                    {
                                        $modify_link.attr( 'href', $inputurl.val() );
                                        wysiwygeditor.closePopup().collapseSelection();
                                    }
                                    else
                                        wysiwygeditor_insertLink( wysiwygeditor,$inputurl.val() );
                                });
            if( placeholder_url )
                $inputurl.attr( 'placeholder', placeholder_url );
            var $okaybutton = $button.click(function(event){
                                    if( $modify_link )
                                    {
                                        $modify_link.attr( 'href', $inputurl.val() );
                                        wysiwygeditor.closePopup().collapseSelection();
                                    }
                                    else
                                        wysiwygeditor_insertLink( wysiwygeditor, $inputurl.val() );
                                    event.stopPropagation();
                                    event.preventDefault();
                                    return false;
                                });
            var $content = $('<div/>').addClass('wysiwyg-toolbar-form')
                                      .attr('unselectable','on');
            $content.append($inputurl).append($okaybutton);
            return $content;
        };

        // Content: Insert image
        var content_insertimage = function(wysiwygeditor)
        {
            // Add image to editor
            var insert_image_wysiwyg = function( url, filename )
            {
                var html = '<img id="wysiwyg-insert-image" src="" alt=""' + (filename ? ' title="'+html_encode(filename)+'"' : '') + ' />';
                wysiwygeditor.insertHTML( html ).closePopup().collapseSelection();
                var $image = $('#wysiwyg-insert-image').removeAttr('id');
                if( max_imagesize )
                {
                    $image.css({maxWidth: max_imagesize[0]+'px',
                                maxHeight: max_imagesize[1]+'px'})
                          .load( function() {
                                $image.css({maxWidth: '',
                                            maxHeight: ''});
                                // Resize $image to fit "clip-image"
                                var image_width = $image.width(),
                                    image_height = $image.height();
                                if( image_width > max_imagesize[0] || image_height > max_imagesize[1] )
                                {
                                    if( (image_width/image_height) > (max_imagesize[0]/max_imagesize[1]) )
                                    {
                                        image_height = parseInt(image_height / image_width * max_imagesize[0]);
                                        image_width = max_imagesize[0];
                                    }
                                    else
                                    {
                                        image_width = parseInt(image_width / image_height * max_imagesize[1]);
                                        image_height = max_imagesize[1];
                                    }
                                    $image.attr('width',image_width)
                                          .attr('height',image_height);
                                }
                            });
                }
                $image.attr('src', url);
            };
            // Create popup
            var $content = $('<div/>').addClass('wysiwyg-toolbar-form')
                                      .attr('unselectable','on');
            // Add image via 'Browse...'
            var $fileuploader = null,
                $fileuploader_input = $('<input type="file" />')
                                        .css({position: 'absolute',
                                              left: 0,
                                              top: 0,
                                              width: '100%',
                                              height: '100%',
                                              opacity: 0,
                                              cursor: 'pointer'});
            if( ! force_imageupload && window.File && window.FileReader && window.FileList )
            {
                // File-API
                var loadImageFromFile = function( file )
                {
                    // Only process image files
                    if( ! file.type.match('image.*') )
                        return;
                    var reader = new FileReader();
                    reader.onload = function(event) {
                        var dataurl = event.target.result;
                        insert_image_wysiwyg( dataurl, file.name );
                    };
                    // Read in the image file as a data URL
                    reader.readAsDataURL( file );
                };
                $fileuploader = $fileuploader_input
                                    .attr('draggable','true')
                                    .change(function(event){
                                        var files = event.target.files; // FileList object
                                        for(var i=0; i < files.length; ++i)
                                            loadImageFromFile( files[i] );
                                    })
                                    .on('dragover',function(event){
                                        event.originalEvent.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
                                        event.stopPropagation();
                                        event.preventDefault();
                                        return false;
                                    })
                                    .on('drop', function(event){
                                        var files = event.originalEvent.dataTransfer.files; // FileList object.
                                        for(var i=0; i < files.length; ++i)
                                            loadImageFromFile( files[i] );
                                        event.stopPropagation();
                                        event.preventDefault();
                                        return false;
                                    });
            }
            else if( on_imageupload )
            {
                // Upload image to a server
                var $input = $fileuploader_input
                                    .change(function(event){
                                        on_imageupload.call( this, insert_image_wysiwyg );
                                    });
                $fileuploader = $('<form/>').append($input);
            }
            if( $fileuploader )
                $('<div/>').addClass( 'wysiwyg-browse' )
                           .html( label_selectImage )
                           .append( $fileuploader )
                           .appendTo( $content );
            // Add image via 'URL'
            var $button = toolbar_button( toolbar_submit );
            var $inputurl = $('<input type="text" value="" />').addClass('wysiwyg-input')
                                .keypress(function(event){
                                    if( event.which == 10 || event.which == 13 )
                                        insert_image_wysiwyg( $inputurl.val() );
                                });
            if( placeholder_url )
                $inputurl.attr( 'placeholder', placeholder_url );
            var $okaybutton = $button.click(function(event){
                                    insert_image_wysiwyg( $inputurl.val() );
                                    event.stopPropagation();
                                    event.preventDefault();
                                    return false;
                                });
            $content.append( $('<div/>').append($inputurl).append($okaybutton) );
            return $content;
        };

        // Content: Insert video
        var content_insertvideo = function(wysiwygeditor)
        {
            // Add video to editor
            var insert_video_wysiwyg = function( url, html )
            {
                url = $.trim(url||'');
                html = $.trim(html||'');
                var website_url = false;
                if( url.length && ! html.length )
                    website_url = url;
                else if( html.indexOf('<') == -1 && html.indexOf('>') == -1 &&
                         html.match(/^(?:https?:\/)?\/?(?:[^:\/\s]+)(?:(?:\/\w+)*\/)(?:[\w\-\.]+[^#?\s]+)(?:.*)?(?:#[\w\-]+)?$/) )
                    website_url = html;
                if( website_url && video_from_url )
                    html = video_from_url( website_url ) || '';
                if( ! html.length && website_url )
                    html = '<video src="' + html_encode(website_url) + '" />';
                wysiwygeditor.insertHTML( html ).closePopup().collapseSelection();
            };
            // Create popup
            var $content = $('<div/>').addClass('wysiwyg-toolbar-form')
                                      .attr('unselectable','on');
            // Add video via '<embed/>'
            var $textareaembed = $('<textarea>').addClass('wysiwyg-input wysiwyg-inputtextarea');
            if( placeholder_embed )
                $textareaembed.attr( 'placeholder', placeholder_embed );
            $('<div/>').addClass( 'wysiwyg-embedcode' )
                       .append( $textareaembed )
                       .appendTo( $content );
            // Add video via 'URL'
            var $button = toolbar_button( toolbar_submit );
            var $inputurl = $('<input type="text" value="" />').addClass('wysiwyg-input')
                                .keypress(function(event){
                                    if( event.which == 10 || event.which == 13 )
                                        insert_video_wysiwyg( $inputurl.val() );
                                });
            if( placeholder_url )
                $inputurl.attr( 'placeholder', placeholder_url );
            var $okaybutton = $button.click(function(event){
                                    insert_video_wysiwyg( $inputurl.val(), $textareaembed.val() );
                                    event.stopPropagation();
                                    event.preventDefault();
                                    return false;
                                });
            $content.append( $('<div/>').append($inputurl).append($okaybutton) );
            return $content;
        };

        // Content: Color palette
        var content_colorpalette = function( wysiwygeditor, forecolor )
        {
            var $content = $('<table/>')
                            .attr('cellpadding','0')
                            .attr('cellspacing','0')
                            .attr('unselectable','on');
            for( var row=1; row < 15; ++row ) // should be '16' - but last line looks so dark
            {
                var $rows = $('<tr/>');
                for( var col=0; col < 25; ++col ) // last column is grayscale
                {
                    var color;
                    if( col == 24 )
                    {
                        var gray = Math.floor(255 / 13 * (14 - row)).toString(16);
                        var hexg = (gray.length < 2 ? '0' : '') + gray;
                        color = '#' + hexg + hexg + hexg;
                    }
                    else
                    {
                        var hue        = col / 24;
                        var saturation = row <= 8 ? row     /8 : 1;
                        var value      = row  > 8 ? (16-row)/8 : 1;
                        color = HSVtoRGB( hue, saturation, value );
                    }
                    $('<td/>').addClass('wysiwyg-toolbar-color')
                              .attr('title', color)
                              .attr('unselectable','on')
                              .css({backgroundColor: color})
                              .click(function(){
                                  var color = this.title;
                                  if( forecolor )
                                      wysiwygeditor.forecolor( color ).closePopup().collapseSelection();
                                  else
                                      wysiwygeditor.highlight( color ).closePopup().collapseSelection();
                                  return false;
                              })
                              .appendTo( $rows );
                }
                $content.append( $rows );
            }
            return $content;
        };

        // Handlers
        var get_toolbar_handler = function( name, button, popup_callback )
        {
            switch( name )
            {
                case 'insertimage':
                    if( ! popup_callback )
                        return null;
                    return function( target ) {
                        popup_callback( content_insertimage(wysiwygeditor), target );
                    };
                case 'insertvideo':
                    if( ! popup_callback )
                        return null;
                    return function( target ) {
                        popup_callback( content_insertvideo(wysiwygeditor), target );
                    };
                case 'insertlink':
                    if( ! popup_callback )
                        return null;
                    return function( target ) {
                        popup_callback( content_insertlink(wysiwygeditor), target );
                    };
                case 'bold':
                    return function() {
                        wysiwygeditor.bold(); // .closePopup().collapseSelection()
                    };
                case 'italic':
                    return function() {
                        wysiwygeditor.italic(); // .closePopup().collapseSelection()
                    };
                case 'underline':
                    return function() {
                        wysiwygeditor.underline(); // .closePopup().collapseSelection()
                    };
                case 'strikethrough':
                    return function() {
                        wysiwygeditor.strikethrough(); // .closePopup().collapseSelection()
                    };
                case 'forecolor':
                    if( ! popup_callback )
                        return null;
                    return function( target ) {
                        popup_callback( content_colorpalette(wysiwygeditor,true), target );
                    };
                case 'highlight':
                    if( ! popup_callback )
                        return null;
                    return function( target ) {
                        popup_callback( content_colorpalette(wysiwygeditor,false), target );
                    };
                case 'alignleft':
                    return function() {
                        wysiwygeditor.align('left'); // .closePopup().collapseSelection()
                    };
                case 'aligncenter':
                    return function() {
                        wysiwygeditor.align('center'); // .closePopup().collapseSelection()
                    };
                case 'alignright':
                    return function() {
                        wysiwygeditor.align('right'); // .closePopup().collapseSelection()
                    };
                case 'alignjustify':
                    return function() {
                        wysiwygeditor.align('justify'); // .closePopup().collapseSelection()
                    };
                case 'subscript':
                    return function() {
                        wysiwygeditor.subscript(); // .closePopup().collapseSelection()
                    };
                case 'superscript':
                    return function() {
                        wysiwygeditor.superscript(); // .closePopup().collapseSelection()
                    };
                case 'indent':
                    return function() {
                        wysiwygeditor.indent(); // .closePopup().collapseSelection()
                    };
                case 'outdent':
                    return function() {
                        wysiwygeditor.indent(true); // .closePopup().collapseSelection()
                    };
                case 'orderedList':
                    return function() {
                        wysiwygeditor.insertList(true); // .closePopup().collapseSelection()
                    };
                case 'unorderedList':
                    return function() {
                        wysiwygeditor.insertList(); // .closePopup().collapseSelection()
                    };
                case 'removeformat':
                    return function() {
                        wysiwygeditor.removeFormat().closePopup().collapseSelection();
                    };
                case 'code':
                    if (button && !button.classes) {
                        button.classes = '';
                    }
                    button.classes += ' wysiwyg-code-button wysiwyg-always-enabled';
                    var $wysiwyg = $(wysiwygeditor.getElement());
                    $textarea.addClass('wysiwyg-editor');
                    return function(target) {
                        var $this = $(target);
                        var wysiwygHtml = $wysiwyg.html();
                        var textAreaContent = $textarea.val();
                        var $container = $textarea.closest('.wysiwyg-container');
                        // If the current mode is code, the click on 'code' represents
                        // a switch to the wysiwyg mode.
                        if ($this.data('isCodeMode')) {
                            $container.removeClass('wysiwyg-code-mode');
                            if (wysiwygHtml !== textAreaContent) {
                                $wysiwyg.html($textarea.val());
                            }
                            $textarea.off('focus blur');
                            $textarea.hide();
                            $wysiwyg.show().focus();
                            $this.siblings('.wysiwyg-toolbar-icon').trigger('wysiwyg-toolbar-icon-enable');
                        } else {
                            $container.addClass('wysiwyg-code-mode');
                            // Update textarea to be of same dimensions as contenteditable (wysiwyg).
                            $textarea.height($wysiwyg.height())
                                .width($wysiwyg.width())
                                .css('max-width', $wysiwyg.width())
                                .css('min-width', $wysiwyg.width());
                            // Trigger a focus and blur events without actually focusing or blurring the element.
                            $textarea.on('focus', function() { $wysiwyg.triggerHandler('focus'); });
                            $textarea.on('blur', function() { $wysiwyg.triggerHandler('blur'); });

                            // The wysiwyg field always updates the textarea meaning
                            // it doesn't need to be updated here.
                            $wysiwyg.hide();
                            // If a placeholder is supplied and the code switch is done with
                            // no content the placeholder will cover the textarea unless it's hidden.
                            $container.find('.wysiwyg-placeholder').hide();
                            $textarea.show().focus();
                            $this.siblings('.wysiwyg-toolbar-icon').trigger('wysiwyg-toolbar-icon-disable');
                        }
                        // Toggle indicated mode
                        $this.data('isCodeMode', !$this.data('isCodeMode'));
                    };
            }
            return null;
        }

        // Create the toolbar
        var toolbar_button = function( button ) {
            return $('<a/>').addClass('wysiwyg-toolbar-icon ' + (button.classes || ''))
                            .attr('href', '#')
                            .attr('title', button.disabled ? disabled_button_title : button.title)
                            .attr('unselectable', 'on')
                            .append(button.image)
                            .on('wysiwyg-toolbar-icon-disable', function() {
                                if ($(this).hasClass('wysiwyg-always-enabled') || button.disabled) {
                                    return;
                                }
                                if (button.hotkey) {
                                    hotkeysDisabled[button.hotkey] = true;
                                }
                                $(this).addClass('wysiwyg-toolbar-icon-disabled');
                            })
                            .on('wysiwyg-toolbar-icon-enable', function() {
                                if (button.disabled) {
                                    return;
                                }
                                if (button.hotkey) {
                                    hotkeysDisabled[button.hotkey] = false;
                                }
                                $(this).removeClass('wysiwyg-toolbar-icon-disabled');
                            })
                            // Disable dragging (as in drag and drop) of buttons.
                            .on('dragstart', function() { return false; })
                            .addClass(button.disabled ? 'wysiwyg-toolbar-icon-disabled' : '')
                            .click(function (e) {
                                if (button.disabled) {
                                    // Prevent click events from firing on disabled buttons
                                    e.stopImmediatePropagation();
                                    return false;
                                } else if ($(this).hasClass('wysiwyg-toolbar-icon-disabled')) {
                                    on_disabled_button_click($(this), button);
                                }
                            });
        };
        var add_buttons_to_toolbar = function( $toolbar, selection, popup_open_callback, popup_position_callback )
        {
            $.each( toolbar_buttons, function(key, value) {
                if( ! value )
                    return ;
                // Skip buttons on the toolbar
                if( selection === false && 'showstatic' in value && ! value.showstatic )
                    return ;
                // Skip buttons on selection
                if( selection === true && 'showselection' in value && ! value.showselection )
                    return ;
                // Click handler
                var toolbar_handler;
                if( 'click' in value )
                    toolbar_handler = function( target ) {
                        value.click( $(target) );
                    };
                else if( 'popup' in value )
                    toolbar_handler = function( target ) {
                        var $popup = popup_open_callback();
                        var overwrite_offset = value.popup( $popup, $(target) );
                        popup_position_callback( $popup, target, overwrite_offset );
                    };
                else
                    toolbar_handler = get_toolbar_handler( key, value, function( $content, target ) {
                        var $popup = popup_open_callback();
                        $popup.append( $content );
                        popup_position_callback( $popup, target );
                        $popup.find('input[type=text]:first').focus();
                    });
                // Create the toolbar button
                var $button;
                if( toolbar_handler )
                    $button = toolbar_button( value ).click( function(event) {
                        // Only handle clicks if the button isn't disabled.
                        if( ! $(this).hasClass( 'wysiwyg-toolbar-icon-disabled' ) ) {
                            toolbar_handler( event.currentTarget );
                            // Give the focus back to the editor if not a popup handler.
                            // Technically not necessary.
                            if( get_toolbar_handler(key) ) {
                                wysiwygeditor.getElement().focus();
                            }
                        }
                        event.stopPropagation();
                        event.preventDefault();
                        return false;
                    });
                else if( value.html )
                    $button = $(value.html);
                if( $button )
                    $toolbar.append( $button );
            });
        };
        // left+top relative to $container
        var popup_position = function($popup, $container, left, top) {
            var popup_width = $popup.width();
            var $offsetparent = $container.offsetParent() || $(document.body);
            // Move $popup as high as possible in the DOM tree: offsetParent of $container
            $offsetparent.append($popup);
            left += $container.offset().left;
            top += $container.offset().top;
            // Trim to offset-parent
            if (left > $offsetparent.width() - popup_width - 1) {
                left = $offsetparent.width() - popup_width - 1;
            }
            if (left < 1) {
                left = 1;
            }
            // Trim to viewport
            var viewport_width = $(window).width();
            if (left > viewport_width - $offsetparent.offset().left - popup_width - 1) {
                left = viewport_width - $offsetparent.offset().left - popup_width - 1;
            }
            if (left < $(window).scrollLeft() - $offsetparent.offset().left + 1) {
                left = $(window).scrollLeft() - $offsetparent.offset().left + 1;
            }
            // Set offset
            $popup.offset({
                left: parseInt(left),
                top: parseInt(top)
            });
        };


        // Transform the textarea to contenteditable
        var hotkeys = {},
            hotkeysDisabled = {},
            autocomplete = null;
        var create_wysiwyg = function( $textarea, $container, $parent, placeholder )
        {
            var handle_autocomplete = function( keypress, key, character, shiftKey, altKey, ctrlKey, metaKey )
            {
                if( ! on_autocomplete )
                    return ;
                var typed = autocomplete || '';
                switch( key )
                {
                    case  8: // backspace
                        typed = typed.substring( 0, typed.length - 1 );
                        // fall through
                    case 13: // enter
                    case 27: // escape
                    case 33: // pageUp
                    case 34: // pageDown
                    case 35: // end
                    case 36: // home
                    case 37: // left
                    case 38: // up
                    case 39: // right
                    case 40: // down
                        if( keypress )
                            return ;
                        character = false;
                        break;
                    default:
                        if( ! keypress )
                            return ;
                        typed += character;
                        break;
                }
                var rc = on_autocomplete( typed, key, character, shiftKey, altKey, ctrlKey, metaKey );
                if( typeof(rc) == 'object' && rc.length )
                {
                    // Show autocomplete
                    var $popup = $(wysiwygeditor.openPopup());
                    $popup.hide().addClass( 'wysiwyg-popup wysiwyg-popuphover' ) // show later
                          .empty().append( rc );
                    autocomplete = typed;
                }
                else
                {
                    // Hide autocomplete
                    wysiwygeditor.closePopup();
                    autocomplete = null;
                    return rc; // swallow key if 'false'
                }
            };

            // Options to wysiwyg.js
            var option = {
                element: $textarea.get(0),
                onKeyDown: function( key, character, shiftKey, altKey, ctrlKey, metaKey )
                    {
                        // Ask master
                        if( on_keydown && on_keydown(key, character, shiftKey, altKey, ctrlKey, metaKey) === false )
                            return false; // swallow key
                        // Exec hotkey (onkeydown because e.g. CTRL+B would oben the bookmarks)
                        if( character && !shiftKey && !altKey && ctrlKey && !metaKey )
                        {
                            var hotkey = character.toLowerCase();
                            if( !hotkeys[hotkey] || hotkeysDisabled[hotkey] )
                                return ;
                            hotkeys[hotkey]();
                            return false; // prevent default
                        }
                        // Handle autocomplete
                        return handle_autocomplete( false, key, character, shiftKey, altKey, ctrlKey, metaKey );
                    },
                onKeyPress: function( key, character, shiftKey, altKey, ctrlKey, metaKey )
                    {
                        // Ask master
                        if( on_keypress && on_keypress(key, character, shiftKey, altKey, ctrlKey, metaKey) === false )
                            return false; // swallow key
                        // Handle autocomplete
                        return handle_autocomplete( true, key, character, shiftKey, altKey, ctrlKey, metaKey );
                    },
                onKeyUp: function( key, character, shiftKey, altKey, ctrlKey, metaKey )
                    {
                        // Ask master
                        if( on_keyup && on_keyup(key, character, shiftKey, altKey, ctrlKey, metaKey) === false )
                            return false; // swallow key
                    },
                onSelection: function( collapsed, rect, nodes, rightclick )
                    {
                        var show_popup = true,
                            $special_popup = null;
                        // Click on a link opens the link-popup
                        if( collapsed )
                            $.each( nodes, function(index, node) {
                                if( $(node).parents('a').length != 0 ) { // only clicks on text-nodes
                                    $special_popup = content_insertlink( wysiwygeditor, $(node).parents('a:first') )
                                    return false; // break
                                }
                            });
                        // Read-Only?
                        if( wysiwygeditor.readOnly() )
                            show_popup = false;
                        // Fix type error - https://github.com/wysiwygjs/wysiwyg.js/issues/4
                        else if( ! rect )
                            show_popup = false;
                        // Force a special popup?
                        else if( $special_popup )
                            ;
                        // A right-click always opens the popup
                        else if( rightclick )
                            ;
                        // Autocomplete popup?
                        else if( autocomplete )
                            ;
                        // No selection-popup wanted?
                        else if( $.inArray('selection',toolbar_position.split('-')) == -1 )
                            show_popup = false;
                        // Selected popup wanted, but nothing selected (=selection collapsed)
                        else if( collapsed )
                            show_popup = false;
                        // Only one image? Better: Display a special image-popup
                        else if( nodes.length == 1 && nodes[0].nodeName == 'IMG' ) // nodes is not a sparse array
                            show_popup = false;
                        if( ! show_popup )
                        {
                            wysiwygeditor.closePopup();
                            return ;
                        }
                        // Popup position
                        var $popup;
                        var apply_popup_position = function()
                        {
                            var popup_width = $popup.outerWidth();
                            // Point is the center of the selection - relative to $parent not the element
                            var container_offset = $parent.offset(),
                                editor_offset = $(wysiwygeditor.getElement()).offset();
                            var left = rect.left + parseInt(rect.width / 2) - parseInt(popup_width / 2) + editor_offset.left - container_offset.left;
                            var top = rect.top + rect.height + editor_offset.top - container_offset.top;
                            popup_position( $popup, $parent, left, top );
                        };
                        // Open popup
                        $popup = $(wysiwygeditor.openPopup());
                        // if wrong popup -> close and open a new one
                        if( ! $popup.hasClass('wysiwyg-popuphover') || (!$popup.data('special')) != (!$special_popup) )
                            $popup = $(wysiwygeditor.closePopup().openPopup());
                        if( autocomplete )
                            $popup.show();
                        else if( ! $popup.hasClass('wysiwyg-popup') )
                        {
                            // add classes + buttons
                            $popup.addClass( 'wysiwyg-popup wysiwyg-popuphover' );
                            if( $special_popup )
                                $popup.empty().append( $special_popup ).data('special',true);
                            else
                                add_buttons_to_toolbar( $popup, true,
                                    function() {
                                        return $popup.empty();
                                    },
                                    apply_popup_position );
                        }
                        // Apply position
                        apply_popup_position();
                    },
                onOpenpopup: function() {
                        add_class_active();
                    },
                onClosepopup: function() {
                        autocomplete = null;
                        remove_class_active();
                    },
                hijackContextmenu: (toolbar_position == 'selection'),
                readOnly: !!$textarea.attr( 'readonly' )
            };
            if( placeholder )
            {
                var $placeholder = $('<div/>').addClass( 'wysiwyg-placeholder' )
                                              .html( placeholder )
                                              .hide();
                $parent.prepend( $placeholder );
                option.onPlaceholder = function( visible ) {
                    if( visible )
                        $placeholder.show();
                    else
                        $placeholder.hide();
                };
            }

            var wysiwygeditor = wysiwyg( option );
            return wysiwygeditor;
        }


        // Create a container
        var $container = $('<div/>').addClass('wysiwyg-container');
        if( classes )
            $container.addClass( classes );
        $textarea.wrap( $container );
        $container = $textarea.parent( '.wysiwyg-container' );

        // Create the editor-wrapper if placeholder
        var $wrapper = false;
        if( placeholder )
        {
            $wrapper = $('<div/>').addClass('wysiwyg-wrapper')
                                  .click(function(){     // Clicking the placeholder focus editor - fixes IE6-IE8
                                     wysiwygeditor.getElement().focus();
                                  });
            $textarea.wrap( $wrapper );
            $wrapper = $textarea.parent( '.wysiwyg-wrapper' );
        }

        // Create the WYSIWYG Editor
        var wysiwygeditor = create_wysiwyg( $textarea, $container, placeholder ? $wrapper : $container, placeholder );
        if( wysiwygeditor.legacy )
        {
            var $textarea = $(wysiwygeditor.getElement());
            $textarea.addClass( 'wysiwyg-textarea' );
            if( $textarea.is(':visible') ) // inside the DOM
                $textarea.width( $container.width() - ($textarea.outerWidth() - $textarea.width()) );
        }
        else
            $(wysiwygeditor.getElement()).addClass( 'wysiwyg-editor' );

        // Support ':active'-class
        var remove_active_timeout = null;
        var add_class_active = function() {
            if( remove_active_timeout )
                clearTimeout( remove_active_timeout );
            remove_active_timeout = null;
            $container.addClass( 'wysiwyg-active' );
            $container.find( '.wysiwyg-toolbar-focus' ).slideDown();
        };
        var remove_class_active = function() {
            if( remove_active_timeout || document.activeElement == wysiwygeditor.getElement() )
                return ;
            remove_active_timeout = setTimeout( function() {
                $container.removeClass( 'wysiwyg-active' );
                if( $.trim(wysiwygeditor.getHTML().replace(/<br\s*[\/]?>/gi,'')).length == 0 )
                    $container.find( '.wysiwyg-toolbar-focus' ).slideUp();
            }, 100 );
        };
        $(wysiwygeditor.getElement()).focus( add_class_active ).blur( remove_class_active );

        // Hotkey+Commands-List
        var commands = {};
        $.each( toolbar_buttons, function(key, value) {
            if( ! value || ! value.hotkey )
                return ;
            var toolbar_handler = get_toolbar_handler( key );
            if( ! toolbar_handler )
                return ;
            hotkeys[value.hotkey.toLowerCase()] = toolbar_handler;
            commands[key] = toolbar_handler;
        });

        // Toolbar on top or bottom
        if( ! $.isEmptyObject(toolbar_buttons) && toolbar_position != 'selection' )
        {
            var toolbar_top = $.inArray( 'top', toolbar_position.split('-') ) != -1;
            var toolbar_focus = $.inArray( 'focus', toolbar_position.split('-') ) != -1;
            var $toolbar = $('<div/>').addClass( 'wysiwyg-toolbar' ).addClass( toolbar_top ? 'wysiwyg-toolbar-top' : 'wysiwyg-toolbar-bottom' );
            if( toolbar_focus )
                $toolbar.hide().addClass( 'wysiwyg-toolbar-focus' );
            // Add buttons to the toolbar
            add_buttons_to_toolbar( $toolbar, false,
                function() {
                    // Open a popup from the toolbar
                    var $popup = $(wysiwygeditor.openPopup());
                    // if wrong popup -> create a new one
                    if( $popup.hasClass('wysiwyg-popup') && $popup.hasClass('wysiwyg-popuphover') )
                        $popup = $(wysiwygeditor.closePopup().openPopup());
                    if( ! $popup.hasClass('wysiwyg-popup') )
                        // add classes + content
                        $popup.addClass( 'wysiwyg-popup' );
                    return $popup;
                },
                function( $popup, target, overwrite_offset ) {
                    // Popup position
                    var $button = $(target);
                    var popup_width = $popup.outerWidth();
                    // Point is the top/bottom-center of the button
                    var left = $button.offset().left - $container.offset().left + parseInt($button.width() / 2) - parseInt(popup_width / 2);
                    var top = $button.offset().top - $container.offset().top;
                    if( toolbar_top )
                        top += $button.outerHeight();
                    else
                        top -= $popup.outerHeight();
                    if( overwrite_offset )
                    {
                        left = overwrite_offset.left;
                        top = overwrite_offset.top;
                    }
                    popup_position( $popup, $container, left, top );
                });
            if( toolbar_top )
                $container.prepend( $toolbar );
            else
                $container.append( $toolbar );
        }

        // Export userdata
        return {
            wysiwygeditor: wysiwygeditor,
            $container: $container
        };
    };

    // jQuery Interface
    $.fn.wysiwyg = function( option, param )
    {
        if( ! option || typeof(option) === 'object' )
        {
            option = $.extend( {}, option );
            return this.each(function() {
                var $that = $(this);
                // Already an editor
                if( $that.data( 'wysiwyg') )
                    return ;

                // Two modes: toolbar on top and on bottom
                var classes = option.classes,
                    placeholder = option.placeholder || $that.attr('placeholder'),
                    toolbar_position = option.toolbar || 'top',
                    toolbar_buttons = option.buttons || {},
                    toolbar_submit = option.submit,
                    label_selectImage = option.selectImage,
                    placeholder_url = option.placeholderUrl || null,
                    placeholder_embed = option.placeholderEmbed || null,
                    max_imagesize = option.maxImageSize || null,
                    on_imageupload = option.onImageUpload || null,
                    force_imageupload = option.forceImageUpload && on_imageupload,
                    video_from_url = option.videoFromUrl || null,
                    on_keydown = option.onKeyDown || null,
                    on_keypress = option.onKeyPress || null,
                    on_keyup = option.onKeyUp || null,
                    on_autocomplete = option.onAutocomplete || null,
                    disabled_button_title = option.disabledButtonTitle || '',
                    on_disabled_button_click = option.onDisabledButtonClick || function () {};

                // Create the WYSIWYG Editor
                var data = create_editor( $that, classes, placeholder, toolbar_position, toolbar_buttons, toolbar_submit, label_selectImage,
                                          placeholder_url, placeholder_embed, max_imagesize, on_imageupload, force_imageupload, video_from_url,
                                          on_keydown, on_keypress, on_keyup, on_autocomplete, disabled_button_title, on_disabled_button_click );
                $that.data( 'wysiwyg', data );
            });
        }
        else if( this.length == 1 )
        {
            var data = this.data('wysiwyg');
            if( ! data )
                return this;
            if( option == 'container' )
                return data.$container;
            if( option == 'shell' )
                return data.wysiwygeditor;
        }
        return this;
    };
});
