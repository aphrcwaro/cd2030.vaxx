const base = p => p ? p.split(/[\\/]/).pop() : ""
const extn = p => { const m = /\.(\w+)$/.exec(p||""); return m ? m[1] : "" }

const setName = (id, txt) => $('#' + id + '_name').text(txt)
const setProg = (id, pct, txt) => {
  $('#' + id + '_fill').css("width", pct + "%")
  $('#' + id + '_text').text(txt || "")
}

async function pickViaElectron($wrap){
  if (!window.uiApi || !window.uiApi.pickFile) return null;
  const accRaw = $wrap.data('accept') || "";
  const acc = accRaw ? accRaw.split(",").map(s=>s.trim().replace(/^\./,"")) : [];
  const multiple = ($wrap.data("multiple") + "") === "true"
  return await window.uiApi.pickFile({ accept: acc, multiple })
}

const FilePickerBinding = new Shiny.InputBinding()
$.extend(FilePickerBinding, {
  find: scope => $(scope).find(".filepicker .filepicker-value"),

  initialize: function(el){
    const $wrap = $(el).closest(".filepicker");
    if (!$wrap.length) return;

    const $btn = $("#" + el.id + "_btn");
    const $name = $("#" + el.id + "_name");
    const placeholder = $name.attr("data-ph") || "No file selected";

    const done = path => {
      console.log("Picked file:", path);
      if (!path) return;
      const val = { datapath: path, name: base(path), ext: extn(path) };

      setName(el.id, val.name);
      setProg(el.id, 20, "Starting");
      setTimeout(()=>setProg(el.id, 55, "Validating"), 180);
      setTimeout(()=>{
        this.setValue(el, val);
        $(el).trigger("change.filepicker")
        Shiny.setInputValue(el.id, val, { priority: "event" });
		setProg(el.id, 100, "Upload complete");
      }, 360);
    };

    $btn.on("click", async e => {
      e.preventDefault();
      const picked = await pickViaElectron($wrap);
      done(Array.isArray(picked) ? picked[0] : picked);
    });

    $wrap.on("dragenter dragover", e => { 
      e.preventDefault(); 
      $wrap.addClass("drop");
    });

    $wrap.on("dragleave drop", e => { 
      e.preventDefault(); 
      $wrap.removeClass("drop");
    });

    $wrap.on("drop", e => {
      const f = e.originalEvent?.dataTransfer?.files?.[0]
      if (f?.path) done(f.path)
    });


    setName(el.id, placeholder);
    setProg(el.id, 0, "");
  },

  getValue: el => $(el).data("filepicker-value") || null,

  setValue: function(el, value){
    $(el).data("filepicker-value", value || null);
    if (value?.datapath){
      setName(el.id, value.name || base(value.datapath));
      setProg(el.id, 100, "Upload complete");
    } else {
      const ph = $("#" + el.id + "_name").attr("data-ph") || "";
      setName(el.id, ph);
      setProg(el.id, 0, "");
    }
  },

  subscribe: (el, cb) => $(el).on("change.filepicker", () => cb()),
  unsubscribe: el => $(el).off(".filepicker"),

  receiveMessage: function(el, data){
    if (data.label !== undefined) 
      $(`label[for='${el.id}']`).text(data.label);
    
    if (data.buttonLabel !== undefined) 
      $(`#${el.id}_btn`).text(data.buttonLabel);
      
    if (data.placeholder !== undefined) {
      const $nm = $(`#${el.id}_name`);
      $nm.text(data.placeholder)
      $nm.attr("data-ph", data.placeholder)
    }

    const $wrap = $(el).closest(".filepicker")
    if ($wrap.length){
      if (data.accept !== undefined) $wrap.data("accept", data.accept)
      if (data.multiple !== undefined) $wrap.data("multiple", data.multiple ? "true" : "false")
    }

    if (data.reset) this.setValue(el, null)
    if (data.value !== undefined) this.setValue(el, data.value)
  }
})

$(function(){
  Shiny.inputBindings.register(FilePickerBinding, "electron.filePicker")
})
