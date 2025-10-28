reportingRateUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId = ns('reporting_rate'),
    dashboardTitle = i18n$t('title_reporting'),
    i18n = i18n,

    countdownOptions(
      title = i18n$t('title_options'),
      column(3, indicatorSelect(ns('indicator'), i18n, 
                                tooltip = 'tooltip_indicator_reporting',
                                indicators = c('ANC' = 'anc_rr',
                                               'Institutional Delivery' = 'idelv_rr',
                                               'Vaccination' = 'vacc_rr'))),
        column(3, numericInput(ns('threshold'), label = i18n$t("title_performance_threshold"), value = 90)),
        column(3, adminLevelInputUI(ns('admin_level'), i18n)),
        column(3, regionInputUI(ns('region'), i18n))
    ),

    tabBox(
        title = i18n$t("title_subnational_reporting_rate"),
        width = 12,

        tabPanel(
          title = i18n$t("title_heat_map"),
          fluidRow(
            column(12, withSpinner(plotlyOutput(ns('district_missing_heatmap')))),
            column(4, downloadButtonUI(ns('download_heatmap_plot'))),
            column(4, downloadButtonUI(ns('download_subnational_data_hm')))
          )
        ),

        tabPanel(
          title = i18n$t("title_bar_graph"),
          fluidRow(
            column(12, plotCustomOutput(ns('district_missing_bar'))),
            column(4, downloadButtonUI(ns('download_bar_plot'))),
            column(4, downloadButtonUI(ns('download_subnational_data_bg')))
          )
        )
      ),
      box(
        title = uiOutput(ns('district_rr_title')),
        status = 'success',
        collapsible = TRUE,
        width = 6,
        fluidRow(
          column(12, plotCustomOutput(ns('district_report_plot'))),
          column(4, downloadButtonUI(ns('download_plot'))),
          column(4, downloadButtonUI(ns('download_data')))
        )
      ),
      box(
        title = i18n$t("title_subnational_low_reporting"),
        width = 6,
        status = 'success',
        fluidRow(
          column(3, selectizeInput(ns('year'),
                                   label = i18n$t("title_year"),
                                   choices =NULL)),
          column(3, offset = 6, downloadButtonUI(ns('download_districts'))),
          column(12, withSpinner(reactableOutput(ns('low_reporting'))))
        )
      )
  )
}

reportingRateServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {
      ns <- session$ns

      state <- reactiveValues(loaded = FALSE)
      indicator <- indicatorSelectServer('indicator')
      admin_level <- adminLevelInputServer('admin_level')
      region <- regionInputServer('region', cache, admin_level, i18n, allow_select_all = TRUE, show_district = FALSE)

      data <- reactive({
        req(cache())
        cache()$countdown_data
      })

      threshold <- reactive({
        req(data())
        cache()$performance_threshold
      })

      subnational_rr <- reactive({
        req(data(), indicator(), admin_level())

        data() %>%
          calculate_average_reporting_rate(admin_level(), region = region()) %>%
          select(any_of(c('adminlevel_1', 'district', 'year', indicator())))
      })

      district_rr <- reactive({
        req(data(), threshold())

        data() %>%
          calculate_district_reporting_rate(threshold(), region())
      })

      district_low_rr <- reactive({
        req(subnational_rr(), input$year, indicator())

        subnational_rr() %>%
          filter(year == as.integer(input$year), !!sym(indicator()) < threshold())
      })

      observeEvent(data(), {
        req(data())
        state$loaded <- FALSE
      })

      observeEvent(input$threshold, {
        req(cache())
        cache()$set_performance_threshold(input$threshold)
      })

      observe({
        req(data(), !state$loaded)
        updateNumericInput(session, 'threshold', value = threshold())
        state$loaded <- TRUE
      })

      observe({
        req(cache()$data_years)
        updateSelectizeInput(session, 'year', choices = cache()$data_years)
      })

      output$district_rr_title <- renderUI({
        if (is.null(region())) {
          i18n$t("title_national_reporting_rate")
        } else {
          region_name <- region()
          str_glue(i18n$t('title_region_reporting_rate'))
        }
      })

      output$district_missing_heatmap <- renderPlotly({
        req(subnational_rr(), indicator(), threshold())
        ggplotly(plot(subnational_rr(),
                      plot_type = 'heat_map',
                      indicator = indicator(),
                      threshold = threshold()))
      })

      output$district_missing_bar <- renderCustomPlot({
        req(subnational_rr(), indicator(), threshold())
        plot(subnational_rr(),
             plot_type = 'bar',
             indicator = indicator(),
             threshold = threshold())
      })

      output$district_report_plot <- renderCustomPlot({
        req(district_rr())
        plot(district_rr())
      })

      output$low_reporting <- renderReactable({
        req(district_low_rr())

        district_low_rr() %>%
          reactable(
            filterable = FALSE,
            minRows = 10,
            columns = list(
              year = colDef(
                aggregate = 'unique'
              )
            ),
            defaultColDef = colDef(
              cell = function(value) {
                if (!is.numeric(value)) {
                  return(value)
                }
                format(round(value), nsmall = 0)
              }
            )
          )
      })

      downloadPlot(
        id = 'download_heatmap_plot',
        filename = reactive('heatmap_plot'),
        data = subnational_rr,
        i18n = i18n,
        plot_function = function(data) {
          plot(data,
               plot_type = 'heat_map',
               indicator = indicator(),
               threshold = threshold())
        }
      )

      downloadPlot(
        id = 'download_bar_plot',
        filename = reactive('bar_plot'),
        data = subnational_rr,
        i18n = i18n,
        plot_function = function(data) {
          plot(data,
               plot_type = 'bar',
               indicator = indicator(),
               threshold = threshold())
        }
      )

      downloadExcel(
        id = 'download_subnational_data_hm',
        filename = reactive('subnational_reporting_rate'),
        data = subnational_rr,
        i18n = i18n,
        excel_write_function = function(wb, data) {
          sheet_name_1 <- i18n$t("title_average_rr")
          addWorksheet(wb, sheet_name_1)
          writeData(wb, sheet = sheet_name_1, x = i18n$t("table_reporting_rate"), startCol = 1, startRow = 1)
          writeData(wb, sheet = sheet_name_1, x = data, startCol = 1, startRow = 3)
        }
      )

      downloadExcel(
        id = 'download_subnational_data_bg',
        filename = reactive('subnational_reporting_rate'),
        data = subnational_rr,
        i18n = i18n,
        excel_write_function = function(wb, data) {
          sheet_name_1 <- i18n$t("title_average_rr")
          addWorksheet(wb, sheet_name_1)
          writeData(wb, sheet = sheet_name_1, x = i18n$t("table_reporting_rate"), startCol = 1, startRow = 1)
          writeData(wb, sheet = sheet_name_1, x = data, startCol = 1, startRow = 3)
        }
      )

      downloadPlot(
        id = 'download_plot',
        filename = reactive('district_rr_plot'),
        data = district_rr,
        i18n = i18n,
        plot_function = function(data) {
          plot(data)
        }
      )

      downloadExcel(
        id = 'download_data',
        filename = reactive('checks_reporting_rate'),
        data = district_rr,
        i18n = i18n,
        excel_write_function = function(wb, data) {
          # Check if sheet exists; if not, add it
          sheet_name_2 <- str_glue(i18n$t("sheet_reporting_district"))
          addWorksheet(wb, sheet_name_2)
          writeData(wb, sheet = sheet_name_2, x = str_glue(i18n$t("table_district_reporting")), startRow = 1, startCol = 1)
          writeData(wb, sheet = sheet_name_2, x = data, startCol = 1, startRow = 3)
        }
      )

      downloadExcel(
        id = 'download_districts',
        filename = reactive(paste0('district_low_reporting_rate_', input$year)),
        data = district_low_rr,
        i18n = i18n,
        excel_write_function = function(wb, data) {
          sheet_name_1 <- i18n$t("title_districts_low_reporting")
          addWorksheet(wb, sheet_name_1)
          writeData(wb, sheet = sheet_name_1, x = str_glue(i18n$t("table_district_reporting_year")), startCol = 1, startRow = 1)
          writeData(wb, sheet = sheet_name_1, x = data, startCol = 1, startRow = 3)
        }
      )

      countdownHeaderServer(
        'reporting_rate',
        cache = cache,
        path = 'numerator-assessment',
        section = 'sec-dqa-reporting-rate',
        i18n = i18n
      )
    }
  )
}
