source('modules/setup/file_upload_helpers.R')
source('modules/setup/modal_helpers.R')
source('ui/directory-input.R')

fileUploadUI <- function(id, i18n) {
  ns <- NS(id)

  box(
    title = i18n$t('title_upload_survey'),
    status = 'primary',
    solidHeader = TRUE,
    width = 12,

    fluidRow(
      column(
        4,
        fileInput(
          inputId = ns('un_data'),
          label = i18n$t('title_upload_un_estimates'),
          buttonLabel = i18n$t('btn_browse_or_drop'),
          placeholder = 'Supported formats: .dta',
          accept = '.dta'
        ),

        messageBoxUI(ns('un_feedback'))
      ),
      column(
        4,
        fileInput(
          inputId = ns('un_mortality_data'),
          label = i18n$t('title_upload_un_mortality'),
          buttonLabel = i18n$t('btn_browse_or_drop'),
          placeholder = 'Supported formats: .dta',
          accept = '.dta'
        ),

        messageBoxUI(ns('un_mortality_feedback'))
      ),
      column(
        4,
        fileInput(
          inputId = ns('wuenic_data'),
          label = i18n$t('title_upload_wuenic'),
          buttonLabel = i18n$t('btn_browse_or_drop'),
          placeholder = 'Supported formats: .dta',
          accept = '.dta'
        ),

        messageBoxUI(ns('wuenic_feedback'))
      )
    ),
    fluidRow(
      column(
        6,
        directoryInput(
          ns('directory_select'),
          label = i18n$t('title_upload_survey'),
          buttonLabel = i18n$t('btn_browse_or_drop'),
          accept = '.dta'
        ),

        messageBoxUI(ns('selected_dir_feedback'))
      ),
      column(
        6,
        tags$label(i18n$t('title_subnational_mapping_opt'), style = 'font-weight: bold; margin-top: 10px; margin-bottom: 5px; display: block;'),
        fluidRow(
          column(6, mappingModalUI(ns('survey_data'), i18n$t('btn_map_survey'))),
          column(6, mappingModalUI(ns('map_data'), i18n$t('btn_map_mapping'))),
          column(12, messageBoxUI(ns('survey_feedback'))),
          column(12, messageBoxUI(ns('map_feedback')))
        )
      )
    )
  )
}

fileUploadServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      un_message_box <- messageBoxServer('un_feedback', i18n = i18n)
      un_mortality_message_box <- messageBoxServer('un_mortality_feedback', i18n = i18n)
      wuenic_message_box <- messageBoxServer('wuenic_feedback', i18n = i18n)
      survey_message_box <- messageBoxServer('survey_feedback', i18n = i18n)
      map_message_box <- messageBoxServer('map_feedback', i18n = i18n)
      selected_dir_box <- messageBoxServer('selected_dir_feedback', 'msg_survey_not_set', i18n = i18n)

      state <- reactiveValues(loaded = FALSE)

      data <- reactive({
        req(cache())
        cache()$countdown_data
      })

      country <- reactive({
        req(cache())
        cache()$country
      })

      country_iso <- reactive({
        req(cache())
        cache()$country_iso
      })

      observeEvent(input$un_data, {
        req(data(), input$un_data)
        file_name <- input$un_data$name

        tryCatch({
          start_year <- min(data()$year)
          end_year <- robust_max(data()$year, 2024)
          un <- load_un_estimates(path = input$un_data$datapath,
                                  country_iso = country_iso(),
                                  start_year = start_year,
                                  end_year = end_year)
          cache()$set_un_estimates(un)
          un_message_box$update_message('msg_upload_success', 'success', list(file_name = file_name))
        },
        error = function(e) {
          print(e)
          un_message_box$update_message('error_upload_failed_unsupported_format', 'error')
        })
      })

      observeEvent(input$un_mortality_data, {
        req(data(), input$un_mortality_data)
        file_name <- input$un_mortality_data$name

        tryCatch({
          mort <- load_un_mortality_data(path = input$un_mortality_data$datapath,
                                         country_iso = country_iso())
          cache()$set_un_mortality_estimates(mort)
          un_mortality_message_box$update_message('msg_upload_success', 'success', list(file_name = file_name))
        },
        error = function(e) {
          print(e)
          un_mortality_message_box$update_message('error_upload_failed_unsupported_format', 'error')
        })
      })

      observeEvent(data(), {
        req(data())
        state$loaded <- FALSE
        if (is.null(cache()$national_survey)) {
          shinyjs::reset('directory_select')
        }
        if (is.null(cache()$un_estimates)) {
          shinyjs::reset('un_data')
        }
        if (is.null(cache()$wuenic_estimates)) {
          shinyjs::reset('wuenic_data')
        }
        if (is.null(cache()$un_mortality_estimates)) {
          shinyjs::reset('un_mortality_data')
        }
      })

      observe({
        req(data(), !state$loaded)
        if (is.null(input$un_mortality_data$name) && !is.null(cache()$un_mortality_estimates)) {
          un_mortality_message_box$update_message('msg_cache_loaded', 'success')
        } else {
          un_mortality_message_box$update_message('msg_awaiting_upload', 'info')
        }
      })

      observe({
        req(data(), !state$loaded)
        if (is.null(input$un_data$name) && !is.null(cache()$un_estimates)) {
          un_message_box$update_message('msg_cache_loaded', 'success')
        } else {
          un_message_box$update_message('msg_awaiting_upload', 'info')
        }
      })

      observeEvent(input$wuenic_data, {
        req(cache())

        file_name <- input$wuenic_data$name

        tryCatch({
          wuenic <- load_wuenic_data(path = input$wuenic_data$datapath,
                                     country_iso = country_iso())
          cache()$set_wuenic_estimates(wuenic)
          wuenic_message_box$update_message('msg_upload_success', 'success', list(file_name = file_name))
        },
        error = function(e) {
          wuenic_message_box$update_message('error_upload_failed_unsupported_format', 'error')
        })
      })

      observe({
        req(data(), !state$loaded)
        if (is.null(input$wuenic_data$name) && !is.null(cache()$wuenic_estimates)) {
          wuenic_message_box$update_message('msg_cache_loaded', 'success')
        } else {
          wuenic_message_box$update_message('msg_awaiting_upload', 'info')
        }
      })

      observe({
        req(data(), !state$loaded)

        state$loaded <- TRUE

        if (all(!is.null(cache()$national_survey), !is.null(cache()$regional_survey),
                !is.null(cache()$wiq_survey), !is.null(cache()$area_survey),
                !is.null(cache()$education_survey))) {
          selected_dir_box$update_message('msg_cache_loading', 'success')
        } else {
          selected_dir_box$add_message('msg_awaiting_upload', 'info')
        }

        if (!is.null(cache()$national_survey)) {
          selected_dir_box$add_message('msg_cache_loaded_national', 'success')
        }
        if (!is.null(cache()$regional_survey)) {
          selected_dir_box$add_message('msg_cache_loaded_regional', 'success')
        }
        if (!is.null(cache()$wiq_survey)) {
          selected_dir_box$add_message('msg_cache_loaded_wealth_index', 'success')
        }
        if (!is.null(cache()$area_survey)) {
          selected_dir_box$add_message('msg_cache_loaded_area', 'success')
        }
        if (!is.null(cache()$education_survey)) {
          selected_dir_box$add_message('msg_cache_loaded_maternal_education', 'success')
        }
      })

      observeEvent(input$directory_select, {
        req(cache(), input$directory_select)

        required_files <- c(
          'all_data.dta',          # National data
          'gregion_data.dta',      # Regional data
          'area_data.dta',         # Area data
          'meduc_data.dta',        # Maternal education data
          'wiq_data.dta'           # Wealth index quintile data
        )
        country <- gsub(' ', '_', country())
        required_files <- gsub('data', country, required_files)

        uploaded_files <- input$directory_select %>%
          filter(name %in% required_files)

        missing_files <- setdiff(required_files, uploaded_files$name)

        selected_dir_box$update_message('msg_files_uploaded', 'success')

        # Log missing files and exit if any are not found
        if (length(missing_files) > 0) {
          files <- paste(missing_files, collapse = ', ')
          selected_dir_box$add_message('msg_missing_required_files', 'error', list(files = files))
          return()  # Exit early if required files are missing
        }

        uploaded_files %>%
          split(seq_len(nrow(.))) %>%
          walk(~ {

          tryCatch({
            file_path <- .x$datapath

            tryCatch(
              cd2030.rmncah:::check_file_path(file_path),
              error = function(e) {
                selected_dir_box$add_message(clean_error_message(e), 'error')
                return()
              }
            )

            if (grepl('^all_', .x$name)) {
              survdata <- load_survey_data(path = file_path, country_iso = country_iso())
              cache()$set_national_survey(survdata)
              new_log <- 'log_loaded_national_survey'
            } else if (grepl('^gregion_', .x$name)) {
              gregion <- load_survey_data(path = file_path, country_iso = country_iso(), admin_level = 'adminlevel_1')
              cache()$set_regional_survey(gregion)
              new_log <- 'log_loaded_regional_survey'
            } else if (grepl('^area_', .x$name)) {
              area <- load_equity_data(path = file_path, country_iso = country_iso())
              cache()$set_area_survey(area)
              new_log <- 'log_loaded_area_survey'
            } else if (grepl('^meduc_', .x$name)) {
              educ <- load_equity_data(path = file_path, country_iso = country_iso())
              cache()$set_education_survey(educ)
              new_log <- 'log_loaded_maternal_education_survey'
            } else if (grepl('^wiq_', .x$name)) {
              wiq <- load_equity_data(path = file_path, country_iso = country_iso())
              cache()$set_wiq_survey(wiq)
              new_log <- 'log_loaded_wealth_index_survey'
            } else {
              new_log <- 'log_unknown_file_pattern'
            }

            selected_dir_box$add_message(new_log, 'success', list(filename = .x$name))
          },
          error = function(e) {
            clean_message <- clean_error_message(e)
            selected_dir_box$add_message('log_file_processing_error', 'error', list(filename = .x$name, error = clean_message))
          })
        })
      })

      survey_data <- reactive({
        req(data())
        cache()$regional_survey
      })

      survey_map <- reactive({
        req(data())
        cache()$survey_mapping
      })

      observe({
        req(data())
        if (is.null(survey_map())) {
          survey_message_box$update_message('msg_survey_mapping_not_done', 'info')
        } else {
          survey_message_box$update_message('msg_survey_mapping_files_uploaded', 'success')
        }
      })

      mappingModalServer(
        id = 'survey_data',
        cache = cache,
        survey_data = survey_data,
        survey_map = survey_map,
        title = i18n$t('msg_manual_mapping'),
        show_col = 'adminlevel_1',
        type = 'survey_mapping',
        i18n = i18n
      )

      map_data <- reactive({
        req(country_iso())
        get_country_shapefile(country_iso(), 'admin_level_1')
      })

      map_map <- reactive({
        req(data())
        cache()$map_mapping
      })

      observe({
        req(data())
        if (is.null(map_map())) {
          map_message_box$update_message('msg_map_mapping_not_done', 'info')
        } else {
          map_message_box$update_message('msg_map_mapping_uploaded', 'success')
        }
      })

      mappingModalServer(
        id = 'map_data',
        cache = cache,
        survey_data = map_data,
        survey_map = map_map,
        title = 'Manual Mapping of Map Data',
        show_col = 'NAME_1',
        type = 'map_mapping',
        i18n = i18n
      )
    }
  )
}
