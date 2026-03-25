import time

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.core.config import settings
from src.core.metrics import DB_POOL_CHECKED_OUT, DB_POOL_SIZE, DB_QUERY_DURATION

engine = create_async_engine(settings.database_url, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "before_execute")
def _before_execute(conn, clauseelement, multiparams, params, execution_options):
    conn.info["query_start"] = time.perf_counter()


@event.listens_for(engine.sync_engine, "after_execute")
def _after_execute(conn, clauseelement, multiparams, params, execution_options, result):
    start = conn.info.pop("query_start", None)
    if start is not None:
        DB_QUERY_DURATION.observe(time.perf_counter() - start)


def collect_pool_stats() -> None:
    """Update pool gauges. Called from the /metrics endpoint."""
    pool = engine.pool
    DB_POOL_SIZE.set(pool.size())
    DB_POOL_CHECKED_OUT.set(pool.checkedout())


async def get_db():
    async with async_session_factory() as session:
        yield session
