#' @title Content Dashboard UI wrapper
#' @description Combines a page header, optional input box, and tab panels
#' @param dashboardId Unique module ID
#' @param dashboardTitle Localized dashboard title
#' @param i18n Translator object
#' @param optionsHeader Optional box() with UI inputs
#' @param ... Tab panels passed to tabBox()
contentDashboard <- function(dashboardId,
                             dashboardTitle,
                             i18n,
                             ...,
                             optionsHeader = NULL,
                             include_report = FALSE,
                             include_notes = FALSE,
                             include_help = TRUE) {

  tagList(
    # Header section with title and standard buttons
    contentHeader(
      id = dashboardId,
      title = dashboardTitle,
      i18n = i18n,
      include_report = include_report,
      include_notes = include_notes,
      include_help = include_help
    ),

    # Main dashboard content with optional options box and tab panels
    contentBody(
      optionsHeader,
      ...
    )
  )

}

#' @title Analysis options box
#' @param optionsTitle Title shown on the box (translated)
#' @param ... UI components (e.g., input UIs)
contentOptions <- function(title, ...) {
  box(
    title = title,
    status = 'primary',
    width = 12,
    solidHeader = TRUE,
    fluidRow(...)
  )
}
