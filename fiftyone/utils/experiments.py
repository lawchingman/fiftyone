"""
Experiment utilities.

| Copyright 2017-2022, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
"""
import logging

import eta.core.utils as etau

import fiftyone as fo
import fiftyone.core.dataset as fod
import fiftyone.core.experiment as foe


logger = logging.getLogger(__name__)


EXPERIMENT_PREFIX = "experiment"


def register_experiment(
    samples,
    exp_key,
    label_fields=None,
    backend=None,
    **kwargs,
):
    config = _parse_config(backend, label_fields, exp_key, **kwargs)
    exp_backend = config.build()
    exp_backend.ensure_requirements()

    exp_dataset = exp_backend.create_experiment_dataset(samples, exp_key)
    results = exp_backend.construct_experiment(samples, exp_key, exp_dataset)

    #
    # Don't allow overwriting an existing run with same `exp_key`, since we
    # need the existing run in order to perform workflows like automatically
    # cleaning up the backend's tasks
    #
    exp_backend.register_run(samples, exp_key, overwrite=False)

    exp_backend.save_run_results(samples, exp_key, results)

    return results


def add_model_run(samples, exp_key, run_key, predictions):

    results = foe.ExperimentMethod.load_run_results(samples, exp_key)
    results.add_model_run(run_key, predictions)

    # Every time a new model run is added, the config must be updated
    exp_backend = results.backend
    config = results.config
    exp_backend.update_run_config(samples, exp_key, config)

    exp_backend.save_run_results(samples, exp_key, results)

    return results


def _parse_config(backend, label_fields, exp_key, **kwargs):
    if backend is None:
        backend = "manual"

    if backend == "manual":
        return ManualExperimentBackendConfig(label_fields, exp_key, **kwargs)

    # if backend == "mlflow":
    #    return MLFlowExperimentBackendConfig(label_fields, **kwargs)

    raise ValueError("Unsupported experiment backend '%s'" % backend)


class ExperimentBackendConfig(foe.ExperimentMethodConfig):
    def __init__(self, label_fields, **kwargs):
        super().__init__(**kwargs)

        self.label_fields = label_fields

    @property
    def method(self):
        """The name of the experiment backend."""
        raise NotImplementedError("subclass must implement method")

    def serialize(self, *args, **kwargs):
        d = super().serialize(*args, **kwargs)
        return d


class ExperimentBackend(foe.ExperimentMethod):
    """Base class for experiment backends.

    Args:
        config: an :class:`ExperimentBackendConfig`
    """

    def cleanup(self, samples, exp_key):
        results = samples.load_experiment_results(exp_key)
        exp_dataset = results.experiment_dataset
        exp_dataset.delete()
        results.cleanup()

    def construct_experiment(self, samples, exp_key):
        """
        Returns:
            an :class:`ExperimentResults`
        """
        raise NotImplementedError(
            "subclass must implement construct_experiment()"
        )

    def create_experiment_dataset(self, samples, exp_key):
        label_fields = self.config.label_fields
        view = samples.select_fields(label_fields)

        exp_name = "%s-experiment-%s" % (view.name, exp_key)
        sample_collection_name = _make_exp_collection_name(view, exp_key)
        exp_dataset = fod._clone_dataset_or_view(
            view,
            exp_name,
            sample_collection_name=sample_collection_name,
        )
        exp_dataset.persistent = True
        return exp_dataset


def _make_exp_collection_name(samples, exp_key):
    root_coll_name = samples._root_dataset._sample_collection_name
    exp_coll_name = "%s.%s-%s" % (EXPERIMENT_PREFIX, root_coll_name, exp_key)
    return exp_coll_name


def _get_parent_sample_collection_name(exp_coll_name):
    removed_key = exp_coll_name.split("-")[0]
    return removed_key[len(EXPERIMENT_PREFIX + ".") :]


def get_parent_dataset(exp_dataset):
    exp_coll_name = exp_dataset._sample_collection_name
    parent_coll_name = _get_parent_sample_collection_name(exp_coll_name)
    return fod._get_dataset(parent_coll_name)


class ExperimentResults(foe.ExperimentResults):
    def __init__(self, samples, config, exp_dataset_name, backend=None):
        if backend is None:
            backend = config.build()
            backend.ensure_requirements()

        self._samples = samples
        self._backend = backend
        self._exp_dataset_name = exp_dataset_name

    @property
    def config(self):
        """The :class:`ExperimentBackendConfig` for these results."""
        return self._backend.config

    @property
    def backend(self):
        """The :class:`ExperimentBackend` for these results."""
        return self._backend

    @property
    def experiment_dataset(self):
        return fod.load_dataset(self._exp_dataset_name)

    def add_model_run(self, run_key, predictions):
        pass

    def evaluate(self):
        pass

    def list_notebooks(self):
        raise NotImplementedError("subclass must implement list_notebooks()")

    def launch_notebook(self):
        raise NotImplementedError("subclass must implement launch_notebook()")

    def launch_tracker(self):
        raise NotImplementedError("subclass must implement launch_tracker()")

    def cleanup(self):
        """Deletes all information for this run from the experiment backend."""
        raise NotImplementedError("subclass must implement cleanup()")

    @classmethod
    def _from_dict(cls, d, samples, config):
        """Builds an :class:`ExperimentResults` from a JSON dict representation
        of it.

        Args:
            d: a JSON dict
            samples: the :class:`fiftyone.core.collections.SampleCollection`
                for the run
            config: the :class:`ExperimentBackendConfig` for the run

        Returns:
            an :class:`ExperimentResults`
        """
        raise NotImplementedError("subclass must implement _from_dict()")


class ManualExperimentBackendConfig(ExperimentBackendConfig):
    def __init__(self, label_fields, exp_key, exp_dir=None, **kwargs):
        super().__init__(label_fields, **kwargs)
        self.exp_key = exp_key
        self.exp_dir = exp_dir

    @property
    def method(self):
        return "manual"


class ManualExperimentBackend(ExperimentBackend):
    def construct_experiment(self, samples, exp_key, exp_dataset):
        exp_dataset_name = exp_dataset.name
        return ManualExperimentResults(
            samples, self.config, exp_dataset_name, backend=self
        )


class ManualExperimentResults(ExperimentResults):
    @classmethod
    def _from_dict(cls, d, samples, config):
        return cls(
            samples,
            config,
            **d,
        )

    def cleanup(self):
        pass
