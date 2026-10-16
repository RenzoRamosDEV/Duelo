# Tasks

## 1. Puertos por capacidad

- [x] 1.1 Crear `application/ports/` con los siete módulos y la fachada `__init__.py` (`__all__`
      explícito); borrar `ports.py`; verificar `just lint` (import-linter incluido), que ningún
      importador cambia y que `just test-unit` pasa.

## 2. Contexto de OpenSpec

- [x] 2.1 Reescribir el stack y las notas de arquitectura de `openspec/config.yaml` con la
      realidad del repo, citando ADRs y changes, y con lo pendiente marcado por fase; verificar
      con `openspec validate` de un change existente que el contexto sigue cargando.

## 3. Docs y cierre

- [ ] 3.1 `docs/architecture.md`: el paquete de puertos; verificar `just ci` en verde y commits
      atómicos.
