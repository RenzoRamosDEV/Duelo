# Spec Delta

## ADDED Requirements

### Requirement: Un SHA inseguro no llega a git
Antes de invocar `git` para escribir la nota, el sistema SHALL comprobar que el SHA del change es
un hexadecimal válido como argumento. Si no lo es, NO SHALL ejecutar ningún proceso `git`, SHALL
registrar un aviso y la activity de la nota SHALL fallar sin
reintento. Las reviews ya registradas y el estado del change NO SHALL cambiar por ese fallo.

#### Scenario: SHA malicioso en el archivo de notas
- **WHEN** un change tiene `head_sha = "--exec=evil"` y se archivan sus reviews
- **THEN** no se ejecuta ningún proceso `git`, se registra un aviso y la activity falla sin
  reintento

#### Scenario: SHA válido
- **WHEN** el SHA es un hexadecimal de 40 caracteres
- **THEN** la nota se escribe como hasta ahora
