filePickerInput <- function(inputId,
                            label,
                            multiple = FALSE,
                            accept = NULL,
                            width = NULL,
                            buttonLabel = "Browse or Drop…",
                            placeholder = "No file selected") {
  
  dep <- htmltools::htmlDependency(
    name = "electron-filepicker",
    version = "0.1.0",
    src = c(href = "filepicker"),     # put the JS below in www/filepicker/
    script = "electron-filepicker.js"
  )
  
  div_tag <- div(
    class = "form-group shiny-input-container filepicker",
    style = css(width = validateCssUnit(width)),
    `data-accept`   = if (length(accept)) paste(accept, collapse = ",") else "",
    `data-multiple` = if (isTRUE(multiple)) "true" else "false",
    
    # label
    tags$label(`for` = inputId, class = "control-label form-label", label),
    
    # Bootstrap input-group (button + filename)
    div(class = "input-group",
        tags$label(class = "input-group-btn input-group-prepend",
                   span(id = paste0(inputId, "_btn"),
                        class = "btn btn-default btn-file",
                        buttonLabel)
        ),
        # your JS writes textContent here -> needs to be a DIV, not <input>
        div(id = paste0(inputId, "_name"),
            class = "form-control",
            placeholder)
    ),
    
    # hidden value element (class used by your .find())
    tags$input(id = inputId, type = "hidden",
               class = "filepicker-value", name = inputId),
    
    # Bootstrap progress bar with IDs your JS expects
    div(class = "progress",
        div(id = paste0(inputId, "_fill"),
            class = "progress-bar",
            role = "progressbar",
            style = "width:0%",
            `aria-valuemin` = "0",
            `aria-valuemax` = "100",
            # JS writes the status here
            span(id = paste0(inputId, "_text"))
        )
    )
  )
  
  htmltools::attachDependencies(div_tag, dep, append = TRUE)
}
