downloadPlot <- function(id, filename, data, plot_function, i18n, label = 'btn_download_plot') {

  downloadButtonServer(
    id = id,
    filename = filename,
    extension = reactive('png'),
    i18n = i18n,
    content = function(file, plot_data) {
      plot_function(plot_data)
      ggsave(file, width = 3840, height = 2160, dpi = 300, units = 'px')
    },
    data = data,
    label = label
  )
}

downloadExcel <- function(id, filename, data, excel_write_function, i18n, label = 'btn_download_data') {
  downloadButtonServer(
    id = id,
    filename = filename,
    extension = reactive('xlsx'),
    i18n = i18n,
    content = function(file, excel_data) {
      wb <- createWorkbook()

      excel_write_function(wb, excel_data)

      # Save the workbook
      saveWorkbook(wb, file, overwrite = TRUE)
    },
    data = data,
    label = label
  )
}
