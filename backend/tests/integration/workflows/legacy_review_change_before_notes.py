"""`ReviewChangeWorkflow` tal como era antes de la nota de git (`archive-reviews`): con la
compensación y los nombres legibles, sin la activity `archive_reviews`.

Igual que los otros `legacy_*`, vive en un módulo mínimo porque el sandbox de workflows reimporta
el módulo que define la clase. Sirve para grabar una historia con el código anterior y comprobar
que el código actual la reproduce (docs/adr/0007)."""

from __future__ import annotations

import asyncio
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ActivityError, ApplicationError

from duelo.application.task_queues import AGENTS_TASK_QUEUE
from duelo.workflows.dto import ReviewChangeInput, RunReviewInput, RunReviewResult
from duelo.workflows.review_details import render_details

RETRY = RetryPolicy(maximum_attempts=3, initial_interval=timedelta(seconds=1))


@workflow.defn(name="ReviewChangeWorkflow")
class ReviewChangeWorkflowBeforeNotes:
    @workflow.run
    async def run(self, review_input: ReviewChangeInput) -> list[RunReviewResult]:
        readable = workflow.patched("readable-workflow-names")
        results: dict[str, RunReviewResult | None] = {}
        if readable:
            workflow.set_current_details(render_details(review_input.agent_names, results))

        async def review(name: str) -> RunReviewResult:
            result = await self._review_one(
                RunReviewInput(
                    change_id=review_input.change_id, agent_name=name, run=review_input.run
                ),
                summary=f"{name} revisa {review_input.head_sha[:7]}".rstrip() if readable else None,
            )
            if readable:
                results[name] = result
                workflow.set_current_details(render_details(review_input.agent_names, results))
            return result

        return list(await asyncio.gather(*(review(name) for name in review_input.agent_names)))

    async def _review_one(
        self, run_input: RunReviewInput, *, summary: str | None = None
    ) -> RunReviewResult:
        try:
            reviewed: RunReviewResult = await workflow.execute_activity(
                "run_review",
                run_input,
                task_queue=AGENTS_TASK_QUEUE,
                result_type=RunReviewResult,
                start_to_close_timeout=timedelta(minutes=5),
                heartbeat_timeout=timedelta(seconds=30),
                retry_policy=RETRY,
                summary=summary,
            )
            return reviewed  # noqa: TRY300 - copia congelada de un workflow anterior
        except ActivityError as error:
            cause = error.cause
            if (
                isinstance(cause, ApplicationError) and cause.non_retryable
            ) or not workflow.patched("compensate-infra-failure"):
                raise
            compensated: RunReviewResult = await workflow.execute_activity(
                "record_review_infrastructure_failure",
                run_input,
                task_queue=AGENTS_TASK_QUEUE,
                result_type=RunReviewResult,
                start_to_close_timeout=timedelta(minutes=1),
                retry_policy=RETRY,
                summary=f"{summary} (registra el fallo)" if summary else None,
            )
            return compensated
