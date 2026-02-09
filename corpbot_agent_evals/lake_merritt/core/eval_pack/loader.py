"""
Eval Pack Loader v2.2
Loads and validates YAML eval pack configurations.
"""

import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class IngestionConfig:
    type: str
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineStage:
    name: str
    scorer: str
    config: Dict[str, Any] = field(default_factory=dict)
    on_fail: str = "continue"  # "continue" or "stop"


@dataclass
class EvalPack:
    name: str
    description: str
    version: str
    ingestion: IngestionConfig
    pipeline: List[PipelineStage]
    reporting: Dict[str, Any] = field(default_factory=dict)


def load_eval_pack(path: str) -> EvalPack:
    """Load eval pack from YAML file."""
    with open(path) as f:
        data = yaml.safe_load(f)

    ingestion_data = data.get('ingestion', {})
    ingestion = IngestionConfig(
        type=ingestion_data.get('type', 'generic_otel'),
        config=ingestion_data.get('config', {})
    )

    pipeline = [
        PipelineStage(
            name=stage['name'],
            scorer=stage['scorer'],
            config=stage.get('config', {}),
            on_fail=stage.get('on_fail', 'continue')
        )
        for stage in data.get('pipeline', [])
    ]

    return EvalPack(
        name=data.get('name', 'unnamed'),
        description=data.get('description', ''),
        version=data.get('version', '1.0'),
        ingestion=ingestion,
        pipeline=pipeline,
        reporting=data.get('reporting', {})
    )
