
(function(){
  
  
  
  // Globals
  // -------
  var selector = 'main > header, main > section';
  var options = {
    selector: selector,
    inline: true,
    //https://www.tiny.cloud/docs/plugins/opensource/image/
    plugins: 'image code',
    toolbar: 'undo redo | link image | code',
    image_title: true,
    automatic_uploads: true,
    images_upload_url: '/media/upload',
    file_picker_types: 'file image media',
    content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
    setup: function(editor) {
      editor.on('OpenWindow', function(e) {
        onEdited();
      });
    }
  };
  var $body;
  var $form;
  var $markupInput;
  
  
  
  function build( e ) {
    
    $body = $('body');
    
    var path = (function(){
      var path = window.location.href.split('/');
      path.shift(); path.shift(); path.shift(); path.unshift('');
      return path.join('/');
    })();
    $form = $([
      '<form action="/content/save" method="POST" id="edit-in-place-form">',
        '<input name="route" type="hidden" value="'+NIECE.route+'">',
        '<input name="orig_menu" type="hidden" value="'+NIECE.page.menus.join(' ')+'">',
        '<input name="title" type="hidden" value="'+NIECE.page.title+'">',
        '<input name="template" type="hidden" value="'+NIECE.page.template+'">',
        '<input name="new" type="hidden" value="'+(NIECE.route=='/page/new'?'true':'false')+'">',
        '<label id="path-edit-in-place">Path <input name="new_route" type="text" value="'+NIECE.route+'"></label>',
        '<label id="published-edit-in-place">Published <input name="published" type="checkbox" checked></label>',
        '<label id="menu-edit-in-place">Menu <input id="menu-checkbox" type="checkbox"> <select name="menu" multiple>',
          '<option value="main"'+(NIECE.page.menus.indexOf('main')>-1?' selected':'')+'>Main</option>',
          '<option value="user"'+(NIECE.page.menus.indexOf('user')>-1?' selected':'')+'>User</option>',
          '<option value="footer"'+(NIECE.page.menus.indexOf('footer')>-1?' selected':'')+'>Footer</option>',
        '</select></label>',
        '<button class="btn btn-success" id="save-edit-in-place">Save</button>',
      '</form>'
    ].join(''));
    $markupInput = $('<input name="markup" type="hidden">').prependTo($form);
    $markupInput.val( getMarkup() );
    $('body').append($form);
    
  }
  
  
  
  function getMarkup() {
        
    var markup = [];
    $('.mce-content-body').each(function(){
      markup.push( '    ' + this.outerHTML );
    });
    markup = markup.join("\n\n");
    markup = markup.replace(/ *mce\-content\-body| *mce\-edit\-focus|id\=\"mce_[0-9]{1,}\"|class\=\"\"/g, '');
    markup = markup.replace(/ *class\=\"\"/g, '');
    markup = markup.replace(/ *spellcheck\=\"false\"| *contenteditable\=\"true\"| *style\=\"position\:\s*relative\;\"/g, '');
    markup = markup.replace(/\<\!\-\-ws\:|\:ws\-\-\>/g, '');
    return markup;
    
  }
  
  
  
  function onEdited( e ) {
    
    if ( !$body.hasClass('edited-in-place') ) $body.addClass('edited-in-place');
    
    $('[data-niece-input]').each(function(){
      var $this = $(this),
          value = $this.attr('data-niece-input');
      $('#edit-in-place-form input[name="'+value+'"]').attr('value', $this.text());
    });
    
    if ( !$markupInput ) return;
    $markupInput.val( getMarkup() );
    
  }
  
  
  
  function start(){
    
    if ( !$body.hasClass('editing-in-place') ) $body.addClass('editing-in-place');
    
    document.addEventListener('keyup', onEdited );
    window.addEventListener('mouseup', onEdited );
    window.addEventListener('touchend', onEdited );
    
    // Initiate TinyMCE
    // ----------------
    if ( typeof tinymce === 'undefined' ) return console.error('tinymce not found.');
    tinymce.init(options);
      
  }
  
  function stop(){
    
    $form.remove();
    document.removeEventListener('keyup', onEdited );
    window.removeEventListener('mouseup', onEdited );
    window.removeEventListener('touchend', onEdited );
    tinymce.remove("div.editable");
      
  }
  
  
  // BEGIN
  // -----
  $( build );
  window.editInPlace = start;
  window.stopEditInPlace = stop;
  
  
})(jQuery);