const i = require('./index');

jest.mock('@actions/core');
const core = require('@actions/core');

jest.mock('@aws-sdk/client-app-mesh');
const {AppMeshClient} = require('@aws-sdk/client-app-mesh');


/**
 *
 * PARAMETER DEFINITIONS
 *
 *****************************************************************************************/

const mockSpec = JSON.stringify(
    {
      'httpRoute': {
        'action': {
          'weightedTargets': [
            {
              'virtualNode': 'my-virtual-node',
              'weight': 1,
            },
          ],
        },
        'match': {
          'prefix': '/',
        },
      },
    },
);

const parameters = {
  meshName: 'my-mesh',
  spec: mockSpec,
  routeName: 'my-route',
  virtualRouterName: 'my-virtual-router',
  action: 'create',
};

const createInput = {
  meshName: 'my-mesh',
  spec: mockSpec,
  routeName: 'my-route',
  virtualRouterName: 'my-virtual-router',
};

const describeInput = {
  meshName: 'my-mesh',
  routeName: 'my-route',
  virtualRouterName: 'my-virtual-router',
};

const deleteInput = {
  ...describeInput,
};


/**
 *
 * MOCKED RESPONSES
 *
 *****************************************************************************************/

const createdOrFoundResponse = {
  $metadata: {
    httpStatusCode: 201,
  },
  route: {
    meshName: 'my-mesh',
    metadata: {
      arn: 'arn:aws:appmesh:us-east-1:1234567890:mesh/my-mesh/virtualRouter/my-virtual-router/route/my-route',
    },
    spec: mockSpec,
    status: {status: 'ACTIVE'}, // or INACTIVE, DELETED
    routeName: 'my-route',
    virtualRouterName: 'my-virtual-router',
  },
};

// DescribeRouteCommandError
const missingResponse = {
  $metadata: {
    httpStatusCode: 404,
  },
  name: 'NotFoundException',
  $fault: 'client',
  message: 'Route with name my-route is not present in mesh my-mesh for account 1234567890',
};


const genericFailureResponse = {
  $metadata: {
    httpStatusCode: 500,
  },
  name: 'NotARealException',
  $fault: 'client',
  message: 'Not A Real Exception. Only used for testing.',
};

/**
 *
 * PARAMETER CONVERSION
 * Converts the supplied (create) parameters into the formats for describe, update, and delete.
 *
 *****************************************************************************************/

describe('createInput', () => {
  test('only returns valid elements', () => {
    expect(i.createInput(parameters)).toStrictEqual(createInput);
  });
});

describe('describeInput', () => {
  test('only returns valid elements', () => {
    expect(i.describeInput(parameters)).toStrictEqual(describeInput);
  });
});

describe('deleteInput', () => {
  test('only returns valid elements', () => {
    expect(i.deleteInput(parameters)).toStrictEqual(deleteInput);
  });
});

/**
 *
 * AWS CALLS
 * Take the supplied parameters and send them to AWS
 *
 *****************************************************************************************/

describe('describeResource', () => {
  test('returns the Route when one exists and it is active', async () => {
    AppMeshClient.send = jest.fn().mockResolvedValue(createdOrFoundResponse);
    await expect(i.describeResource(AppMeshClient, parameters)).resolves.toEqual(createdOrFoundResponse);
  });
  test('throws an error when none exists already', async () => {
    AppMeshClient.send = jest.fn().mockRejectedValue(missingResponse);
    await expect(i.describeResource(AppMeshClient, parameters)).rejects.toEqual(missingResponse);
  });
  test('throws an error when a generic error occurs', async () => {
    AppMeshClient.send = jest.fn().mockRejectedValue(genericFailureResponse);
    await expect(i.describeResource(AppMeshClient, parameters)).rejects.toEqual(genericFailureResponse);
  });
});

describe('createResource', () => {
  test('returns the Route when it is created successfully', async () => {
    AppMeshClient.send = jest.fn().mockResolvedValue(createdOrFoundResponse);
    await expect(i.createResource(AppMeshClient, parameters)).resolves.toEqual(createdOrFoundResponse);
  });
  test('throws an error when a generic error occurs', async () => {
    AppMeshClient.send = jest.fn().mockRejectedValue(genericFailureResponse);
    await expect(i.createResource(AppMeshClient, parameters)).rejects.toEqual(genericFailureResponse);
  });
});

describe('deleteResource', () => {
  test('returns the Route when it is deleted successfully', async () => {
    AppMeshClient.send = jest.fn().mockResolvedValue(createdOrFoundResponse);
    await expect(i.deleteResource(AppMeshClient, parameters)).resolves.toEqual(createdOrFoundResponse);
  });
  test('throws an error when a generic error occurs', async () => {
    AppMeshClient.send = jest.fn().mockRejectedValue(genericFailureResponse);
    await expect(i.deleteResource(AppMeshClient, parameters)).rejects.toEqual(genericFailureResponse);
  });
});


/**
 *
 * FIND/CREATE/DELETE BUSINESS LOGIC
 *
 *****************************************************************************************/

describe('findOrCreate', () => {
  test('creates the Route when none exists already', async () => {
    AppMeshClient.send = jest.fn()
        .mockRejectedValueOnce(missingResponse) // DescribeRouteCommand
        .mockResolvedValueOnce(createdOrFoundResponse); // CreateRouteCommand
    await expect(i.findOrCreate(AppMeshClient, parameters)).resolves.toEqual(createdOrFoundResponse);
  });

  test('returns the Route when one exists and it is active', async () => {
    AppMeshClient.send = jest.fn().mockResolvedValue(createdOrFoundResponse); // DescribeRouteCommand
    await expect(i.findOrCreate(AppMeshClient, parameters)).resolves.toEqual(createdOrFoundResponse);
  });

  test('throws an error when a generic error occurs', async () => {
    AppMeshClient.send = jest.fn().mockRejectedValueOnce(genericFailureResponse); // CreateRouteCommand
    await expect(i.findOrCreate(AppMeshClient, parameters)).rejects.toEqual(genericFailureResponse);
  });
});


/**
 *
 * GITHUB ACTIONS INTERFACE
 * - Gets parameters from the user.
 * - Posts results as output.
 *
 *****************************************************************************************/

describe('getParameters', () => {
  describe('when there is not meshOwner', () => {
    test('it does not include meshOwner', () => {
      core.getInput = jest
          .fn()
          .mockReturnValueOnce('') // zeroeth call is to get the action
          .mockReturnValueOnce('') // first call is to get the mesh owner
          .mockReturnValueOnce('mesh') // second call is to get the name of the Mesh
          .mockReturnValueOnce('name') // third call is to get the name
          .mockReturnValueOnce('virtualRouterName') // fourth call is to get the name of the VirtualRouter
          .mockReturnValueOnce(mockSpec); // fifth call is to get the spec

      expect(i.getParameters()).toStrictEqual(
          {
            action: 'create',
            spec: JSON.parse(mockSpec),
            routeName: 'name',
            meshName: 'mesh',
            virtualRouterName: 'virtualRouterName',
          },
      );
    });
  });
  describe('when there is meshOwner', () => {
    test('it includes meshOwner', () => {
      core.getInput = jest
          .fn()
          .mockReturnValueOnce('') // zeroeth call is to get the action
          .mockReturnValueOnce('meshOwner') // first call is to get the mesh owner
          .mockReturnValueOnce('mesh') // second call is to get the name of the Mesh
          .mockReturnValueOnce('name') // third call is to get the name
          .mockReturnValueOnce('virtualRouterName') // fourth call is to get the name of the VirtualRouter
          .mockReturnValueOnce(mockSpec); // fifth call is to get the spec

      expect(i.getParameters()).toStrictEqual(
          {
            action: 'create',
            spec: JSON.parse(mockSpec),
            routeName: 'name',
            meshName: 'mesh',
            meshOwner: 'meshOwner',
            virtualRouterName: 'virtualRouterName',
          },
      );
    });
  });
  describe('when there are tags', () => {
    test('it includes tags', () => {
      core.getInput = jest
          .fn()
          .mockReturnValueOnce('') // zeroeth call is to get the action
          .mockReturnValueOnce('') // first call is to get the mesh owner
          .mockReturnValueOnce('mesh') // second call is to get the name of the Mesh
          .mockReturnValueOnce('name') // third call is to get the name
          .mockReturnValueOnce('virtualRouterName') // fourth call is to get the name of the VirtualRouter
          .mockReturnValueOnce(mockSpec) // fifth call is to get the spec
          .mockReturnValueOnce('[{"key": "my-key"}]'); // sixth call is to get the tags

      expect(i.getParameters()).toStrictEqual(
          {
            action: 'create',
            spec: JSON.parse(mockSpec),
            routeName: 'name',
            meshName: 'mesh',
            tags: [{key: 'my-key'}],
            virtualRouterName: 'virtualRouterName',
          },
      );
    });
  });
  describe('when there is both meshOwner and tags', () => {
    test('it includes tags and meshOwner', () => {
      core.getInput = jest
          .fn()
          .mockReturnValueOnce('') // zeroeth call is to get the action
          .mockReturnValueOnce('meshOwner') // first call is to get the mesh owner
          .mockReturnValueOnce('mesh') // second call is to get the name of the Mesh
          .mockReturnValueOnce('name') // third call is to get the name
          .mockReturnValueOnce('virtualRouterName') // fourth call is to get the name of the VirtualRouter
          .mockReturnValueOnce(mockSpec) // fifth call is to get the spec
          .mockReturnValueOnce('[{"key": "my-key"}]'); // sixth call is to get the tags

      expect(i.getParameters()).toStrictEqual(
          {
            action: 'create',
            spec: JSON.parse(mockSpec),
            routeName: 'name',
            meshName: 'mesh',
            meshOwner: 'meshOwner',
            tags: [{key: 'my-key'}],
            virtualRouterName: 'virtualRouterName',
          },
      );
    });
  });

  describe('when there is a typo in the spec', () => {
    test('it throws an error', () => {
      core.getInput = jest
          .fn()
          .mockReturnValueOnce('') // zeroeth call is to get the action
          .mockReturnValueOnce('') // first call is to get the mesh owner
          .mockReturnValueOnce('mesh') // second call is to get the name of the Mesh
          .mockReturnValueOnce('name') // third call is to get the name
          .mockReturnValueOnce('virtualRouterName') // fourth call is to get the name of the VirtualRouter
          .mockReturnValueOnce('{') // fifth call is to get the spec
          .mockReturnValueOnce('[{"key": "my-key"}]'); // sixth call is to get the tags

      expect(() => i.getParameters()).toThrow('Invalid JSON for spec: Unexpected end of JSON input: {');
    });
  });
});

describe('postToGithub', () => {
  test('sets response and arn when created or found', () => {
    i.postToGithub(createdOrFoundResponse);
    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'response', createdOrFoundResponse);
    expect(core.setOutput).toHaveBeenNthCalledWith(2, 'arn', 'arn:aws:appmesh:us-east-1:1234567890:mesh/my-mesh/virtualRouter/my-virtual-router/route/my-route');
  });
});
