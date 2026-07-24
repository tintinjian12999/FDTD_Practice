cmake_minimum_required(VERSION 3.25)

project(ufdtd VERSION 0.1.0 LANGUAGES C)

include(CTest)

option(UFDTD_WARNINGS_AS_ERRORS "Treat project warnings as errors" OFF)

add_library(ufdtd_warnings INTERFACE)
if(CMAKE_C_COMPILER_ID STREQUAL "GNU")
  target_compile_options(ufdtd_warnings INTERFACE -Wall -Wextra -Wpedantic)
  if(UFDTD_WARNINGS_AS_ERRORS)
    target_compile_options(ufdtd_warnings INTERFACE -Werror)
  endif()
endif()

function(add_ufdtd_smoke target source)
  add_executable(${target} ${source})
  target_compile_features(${target} PRIVATE c_std_17)
  target_link_libraries(${target} PRIVATE ufdtd_warnings)
  add_test(NAME ${target} COMMAND ${target})
endfunction()

file(MAKE_DIRECTORY "${PROJECT_SOURCE_DIR}/output/smoke")

add_ufdtd_smoke(math_smoke examples/smoke/math_smoke.c)
add_ufdtd_smoke(memory_smoke examples/smoke/memory_smoke.c)

add_executable(signal_writer examples/smoke/signal_writer.c)
target_compile_features(signal_writer PRIVATE c_std_17)
target_link_libraries(signal_writer PRIVATE ufdtd_warnings)
add_test(
  NAME signal_writer
  COMMAND signal_writer "${PROJECT_SOURCE_DIR}/output/smoke/signal.csv"
)
