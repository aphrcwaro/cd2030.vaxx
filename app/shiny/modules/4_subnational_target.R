subnationalTargetUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId = ns('low_reporting'),
    dashboardTitle = i18n$t('title_global_coverage'),
    i18n = i18n,

    countdownOptions(
      title = i18n$t('title_options'),
      column(3, denominatorInputUI(ns('denominator'), i18n)),
      column(3, regionInputUI(ns('region'), i18n))
    ),

    tabBox(
      title = i18n$t('title_global_coverage'),
      width = 12,

      tabPanel(title = i18n$t("opt_vaccine_coverage"), downloadCoverageUI(ns('vaccine'))),
      tabPanel(title = i18n$t("dropout"), downloadCoverageUI(ns('dropout')))
    ),

    box(
      title = i18n$t('title_district_low_reporting'),
      status = 'success',
      collapsible = TRUE,
      width = 6,
      fluidRow(
        column(3, selectizeInput(ns('indicator'), label = i18n$t('title_indicator'), choice = get_analysis_indicators())),
        column(3, offset = 6, downloadButtonUI(ns('download_regions'))),
        column(12, withSpinner(reactableOutput(ns('district_low_reporting'))))
      )
    )
  )
}

subnationalTargetServer <- function(id, cache, i18n) {

  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      denominatorInputServer('denominator', cache, i18n)
      region <- regionInputServer('region', cache, reactive('adminlevel_1'), i18n)

      indicator_coverage <- reactive({
        req(cache(), cache()$check_inequality_params)
        if (is.null(region())) {
          cache()$indicator_coverage_admin1
        } else {
          cache()$calculate_indicator_coverage('adminlevel_1', region())
        }
      })
      
      denominator <- reactive({
        req(input$indicator)
        cache()$get_denominator(input$indicator)
      })

      vaccine_threshold <- reactive({
        req(indicator_coverage(), cache()$denominator)
        indicator_coverage() %>%
          calculate_threshold(indicator = 'vaccine', denominator = cache()$denominator)
      })
      
      dropout_threshold <- reactive({
        req(indicator_coverage(), cache()$denominator)
        indicator_coverage() %>%
          calculate_threshold(indicator = 'dropout', denominator = cache()$denominator)
      })

      downloadCoverageServer(
        id = 'dropout',
        filename = reactive(paste0('droput_target_', cache()$maternal_denominator)),
        data_fn = dropout_threshold,
        sheet_name = reactive(i18n$t("opt_dropout")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'vaccine',
        filename = reactive(paste0('vaccine_global_target_', cache()$denominator)),
        data_fn = vaccine_threshold,
        sheet_name = reactive(i18n$t("opt_vaccine_coverage")),
        i18n = i18n
      )

      district_coverage_rate <- reactive({
        req(indicator_coverage(), denominator())
        indicator_coverage() %>%
          filter_high_performers(indicator = input$indicator, denominator = denominator())
      })

      output$district_low_reporting <- renderReactable({
        req(district_coverage_rate())
        district_coverage_rate() %>%
          reactable()
      })

      downloadExcel(
        id = 'download_regions',
        filename = reactive(paste0('district_high_coverage_rate', input$year)),
        data = district_coverage_rate,
        i18n = i18n,
        excel_write_function = function(wb, data) {
          sheet_name_1 <- i18n$t("title_districts_coverage_rate")
          addWorksheet(wb, sheet_name_1)
          writeData(wb, sheet = sheet_name_1, x = i18n$t("title_districts_coverage_rate"), startCol = 1, startRow = 1)
          writeData(wb, sheet = sheet_name_1, x = data, startCol = 1, startRow = 3)
        }
      )

      countdownHeaderServer(
        'low_reporting',
        cache = cache,
        path = 'subnational-global-coverage',
        i18n = i18n
      )

    }
  )
}
