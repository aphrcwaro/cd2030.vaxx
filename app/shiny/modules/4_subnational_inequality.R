subnationalInequalityUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId = ns('subnational_inequality'),
    dashboardTitle = i18n$t('title_subnational_inequality'),
    i18n = i18n,

    countdownOptions = countdownOptions(
      title = i18n$t('title_analysis_options'),
      column(3, denominatorInputUI(ns('denominator'), i18n)),
      column(3, regionInputUI(ns('region'), i18n))
    ),

    tabBox(
      title = i18n$t('title_subnational_inequality'),
      width = 12,

      tabPanel(title = i18n$t("opt_penta1"), downloadCoverageUI(ns('penta1'))),
      tabPanel(title = i18n$t("opt_mcv1"), downloadCoverageUI(ns('measles1'))),
      tabPanel(
        title = i18n$t("opt_custom_check"),
        fluidRow(
          column(3, indicatorSelect(ns('indicator'), i18n))
        ),
        downloadCoverageUI(ns('custom'))
      )
    )
  )
}

subnationalInequalityServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      denominatorInputServer('denominator', cache, i18n)
      region <- regionInputServer('region', cache, reactive('adminlevel_1'), i18n)
      indicator <- indicatorSelectServer('indicator', cache)

      inequalities <- reactive({
        req(cache(), cache()$check_inequality_params, region())
        cache()$calculate_inequality(admin_level = 'adminlevel_1', region = region())
      })

      penta1_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'penta1', denominator = cache()$get_denominator('penta1'))
      })

      measles1_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'measles1', denominator = cache()$get_denominator('measles1'))
      })

      custom_inequality <- reactive({
        req(inequalities(), indicator())
        inequalities() %>%
          filter_inequality(indicator = indicator(), denominator = cache()$get_denominator(indicator()))
      })

      downloadCoverageServer(
        id = 'measles1',
        filename = reactive(paste0('measles1_admin_level_inequality_', cache()$get_denominator('measles1'))),
        data_fn = measles1_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t("title_mcv1_inequality"))
      )

      downloadCoverageServer(
        id = 'penta1',
        filename = reactive(paste0('penta1admin_level_inequality_', cache()$get_denominator('penta1'))),
        data_fn = penta1_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t("title_penta1_inequality"))
      )

      downloadCoverageServer(
        id = 'custom',
        filename = reactive(paste0(indicator(), '_admin_level_inequality_', cache()$get_denominator(indicator()))),
        data_fn = custom_inequality,
        i18n = i18n,
        sheet_name = reactive(paste0(indicator(), ' Inequality'))
      )

      countdownHeaderServer(
        'subnational_inequality',
        cache = cache,
        path = 'subnational-inequality',
        i18n = i18n
      )
    }
  )
}
