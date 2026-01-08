from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in budget/__init__.py
from alphax_budget import __version__ as version

setup(
	name="alphax_budget",
	version=version,
	description="AlphaX Budget Management & Finance Intelligence",
	author="IRSAA / AlphaX",
	author_email="support@alphax",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
